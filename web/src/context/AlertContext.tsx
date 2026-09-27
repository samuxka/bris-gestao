import React, { createContext, useContext, useState, ReactNode } from 'react';

type AlertType = 'info' | 'success' | 'error' | 'warning' | 'prompt';

interface AlertState {
  isOpen: boolean;
  title?: string;
  message: string;
  type: AlertType;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
  isConfirm: boolean;
  isPrompt: boolean;
  promptValue: string;
}

interface AlertContextProps {
  showAlert: (message: string, title?: string, type?: AlertType) => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
  showPrompt: (message: string, defaultValue: string, onConfirm: (value: string) => void, title?: string) => void;
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AlertState>({
    isOpen: false,
    message: '',
    type: 'info',
    isConfirm: false,
    isPrompt: false,
    promptValue: '',
  });

  const showAlert = (message: string, title?: string, type: AlertType = 'info') => {
    setState({ isOpen: true, message, title, type, isConfirm: false, isPrompt: false, promptValue: '' });
  };

  const showConfirm = (message: string, onConfirm: () => void, title?: string) => {
    setState({ isOpen: true, message, title, type: 'warning', isConfirm: true, isPrompt: false, promptValue: '', onConfirm });
  };

  const showPrompt = (message: string, defaultValue: string, onConfirm: (value: string) => void, title?: string) => {
    setState({ isOpen: true, message, title, type: 'prompt', isConfirm: true, isPrompt: true, promptValue: defaultValue, onConfirm });
  };

  const handleClose = () => {
    setState(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = () => {
    if (state.onConfirm) {
      if (state.isPrompt) state.onConfirm(state.promptValue);
      else state.onConfirm();
    }
    handleClose();
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}
      {state.isOpen && (
        <div className="modal-overlay" onClick={handleClose} style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            {state.title && <h3 style={{ marginTop: 0, marginBottom: '16px' }}>{state.title}</h3>}
            <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>{state.message}</p>
            
            {state.isPrompt && (
              <input
                type="text"
                className="filter-select"
                style={{ width: '100%', marginBottom: '24px', boxSizing: 'border-box' }}
                value={state.promptValue}
                onChange={e => setState(s => ({ ...s, promptValue: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleConfirm();
                }}
                autoFocus
              />
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {state.isConfirm && (
                <button className="btn-secondary" onClick={handleClose}>
                  Cancelar
                </button>
              )}
              <button 
                className={state.isConfirm || state.type === 'error' ? "btn-primary" : "btn-primary"} 
                style={state.type === 'error' || (state.isConfirm && !state.isPrompt) ? { backgroundColor: 'var(--danger-color)', borderColor: 'var(--danger-color)' } : {}}
                onClick={handleConfirm}
              >
                {state.isConfirm ? 'Confirmar' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlert must be used within an AlertProvider');
  return context;
};
