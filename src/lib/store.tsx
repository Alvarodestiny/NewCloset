import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { createContext, ReactNode, useContext, useEffect, useReducer, useRef } from 'react';
import { BodyMeasurements, clampBody, DEFAULT_BODY } from './body/measurements';
import { cutoutAvailable, deleteLocalImage, requestCutout } from './cutout';
import { Garment, Outfit, OutfitSlots, Profile, Slot } from './types';

export const FREE_LIMITS = { garments: 25, outfits: 3, aiScans: 1 };

interface State {
  ready: boolean;
  garments: Garment[];
  outfits: Outfit[];
  current: OutfitSlots; // what the mannequin is wearing right now
  profile: Profile;
}

const initialState: State = {
  ready: false,
  garments: [],
  outfits: [],
  current: {},
  profile: { skinTone: '#E8C4A8', body: DEFAULT_BODY.female, isPremium: false, aiScansUsed: 0 },
};

type Action =
  | { type: 'hydrate'; state: Partial<State> }
  | { type: 'addGarment'; garment: Garment }
  | { type: 'updateGarment'; garment: Garment }
  | { type: 'patchGarment'; id: string; patch: Partial<Garment> }
  | { type: 'removeGarment'; id: string }
  | { type: 'wear'; slot: Slot; garmentId?: string }
  | { type: 'setCurrent'; slots: OutfitSlots }
  | { type: 'saveOutfit'; outfit: Outfit }
  | { type: 'removeOutfit'; id: string }
  | { type: 'updateProfile'; patch: Partial<Profile> };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate': {
      const garments = (action.state.garments ?? state.garments).map((g) =>
        g.cutoutStatus === 'processing' ? { ...g, cutoutStatus: 'failed' as const, cutoutError: 'Interrumpido' } : g,
      );
      return { ...state, ...action.state, garments, profile: { ...state.profile, ...action.state.profile }, ready: true };
    }
    case 'addGarment':
      return { ...state, garments: [action.garment, ...state.garments] };
    case 'updateGarment':
      return { ...state, garments: state.garments.map((g) => (g.id === action.garment.id ? action.garment : g)) };
    case 'patchGarment':
      return { ...state, garments: state.garments.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)) };
    case 'removeGarment': {
      const strip = (slots: OutfitSlots) =>
        Object.fromEntries(Object.entries(slots).filter(([, id]) => id !== action.id)) as OutfitSlots;
      return {
        ...state,
        garments: state.garments.filter((g) => g.id !== action.id),
        current: strip(state.current),
        outfits: state.outfits.map((o) => ({ ...o, slots: strip(o.slots) })),
      };
    }
    case 'wear': {
      const next: OutfitSlots = { ...state.current };
      if (action.garmentId) {
        next[action.slot] = action.garmentId;
        // A dress replaces top + bottom and vice versa.
        if (action.slot === 'dress') {
          delete next.top;
          delete next.bottom;
        } else if (action.slot === 'top' || action.slot === 'bottom') {
          delete next.dress;
        }
      } else {
        delete next[action.slot];
      }
      return { ...state, current: next };
    }
    case 'setCurrent':
      return { ...state, current: action.slots };
    case 'saveOutfit':
      return { ...state, outfits: [action.outfit, ...state.outfits] };
    case 'removeOutfit':
      return { ...state, outfits: state.outfits.filter((o) => o.id !== action.id) };
    case 'updateProfile':
      return { ...state, profile: { ...state.profile, ...action.patch } };
  }
}

const STORAGE_KEY = 'newcloset:v1';

interface Store extends State {
  canAddGarment: boolean;
  canSaveOutfit: boolean;
  canUseAi: boolean;
  addGarment: (g: Omit<Garment, 'id' | 'createdAt'>) => Garment;
  updateGarment: (g: Garment) => void;
  removeGarment: (id: string) => void;
  wear: (slot: Slot, garmentId?: string) => void;
  setCurrent: (slots: OutfitSlots) => void;
  saveOutfit: (name: string) => void;
  removeOutfit: (id: string) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setBody: (body: BodyMeasurements) => void;
  /** Removes the background of a garment photo (runs on the server). */
  processCutout: (garment: Garment) => Promise<void>;
  garmentById: (id?: string) => Garment | undefined;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => dispatch({ type: 'hydrate', state: raw ? JSON.parse(raw) : {} }))
      .catch(() => dispatch({ type: 'hydrate', state: {} }));
  }, []);

  useEffect(() => {
    if (!state.ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { ready, ...persisted } = state;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => {});
    }, 300);
  }, [state]);

  const premium = state.profile.isPremium;
  const store: Store = {
    ...state,
    canAddGarment: premium || state.garments.length < FREE_LIMITS.garments,
    canSaveOutfit: premium || state.outfits.length < FREE_LIMITS.outfits,
    canUseAi: premium || state.profile.aiScansUsed < FREE_LIMITS.aiScans,
    addGarment: (g) => {
      const garment: Garment = { ...g, id: randomUUID(), createdAt: Date.now() };
      dispatch({ type: 'addGarment', garment });
      return garment;
    },
    updateGarment: (garment) => dispatch({ type: 'updateGarment', garment }),
    removeGarment: (id) => {
      const g = state.garments.find((x) => x.id === id);
      deleteLocalImage(g?.cutoutUrl);
      deleteLocalImage(g?.imageUrl);
      dispatch({ type: 'removeGarment', id });
    },
    wear: (slot, garmentId) => dispatch({ type: 'wear', slot, garmentId }),
    setCurrent: (slots) => dispatch({ type: 'setCurrent', slots }),
    saveOutfit: (name) =>
      dispatch({ type: 'saveOutfit', outfit: { id: randomUUID(), name, slots: state.current, createdAt: Date.now() } }),
    removeOutfit: (id) => dispatch({ type: 'removeOutfit', id }),
    updateProfile: (patch) => dispatch({ type: 'updateProfile', patch }),
    setBody: (body) => dispatch({ type: 'updateProfile', patch: { body: clampBody(body) } }),
    processCutout: async (garment) => {
      if (!cutoutAvailable() || !garment.imageUrl) return;
      dispatch({ type: 'patchGarment', id: garment.id, patch: { cutoutStatus: 'processing', cutoutError: undefined } });
      try {
        const { cutoutUrl, fit } = await requestCutout(garment);
        deleteLocalImage(garment.cutoutUrl);
        dispatch({ type: 'patchGarment', id: garment.id, patch: { cutoutUrl, fit, cutoutStatus: 'done' } });
      } catch (e) {
        dispatch({ type: 'patchGarment', id: garment.id, patch: { cutoutStatus: 'failed', cutoutError: (e as Error).message } });
      }
    },
    garmentById: (id) => (id ? state.garments.find((g) => g.id === id) : undefined),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
