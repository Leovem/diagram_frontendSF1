import { create } from 'zustand';
import { nanoid } from 'nanoid';

export const useEditorStore = create((set) => ({
  elements: [],
  selectedId: null,

  addElement: (type) =>
    set((state) => ({
      elements: [
        ...state.elements,
        {
          id: nanoid(),
          type,
          x: 100,
          y: 100,
          width: 150,
          height: 100,
          rotation: 0,
          fill: '#60a5fa',
          text: type === 'text' ? 'Texto editable' : '',
        },
      ],
    })),

  setSelectedId: (id) => set({ selectedId: id }),

  updateElement: (id, updates) =>
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      ),
    })),

  deleteElement: (id) =>
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedId: null,
    })),
    
  // NUEVO: control de edición de texto flotante
  editing: false,
  setEditing: (val) => set({ editing: val }),
}));