import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../theme/theme';

type AlertType = 'info' | 'success' | 'error' | 'warning';


interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'cancel' | 'default' | 'destructive';
}

interface AlertState {
  isOpen: boolean;
  title?: string;
  message: string;
  type: AlertType;
  buttons?: AlertButton[];
  isConfirm?: boolean;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface AlertContextProps {
  showAlert: (title: string, message: string, type?: AlertType) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string) => void;
  showOptions: (title: string, message: string, buttons: AlertButton[]) => void;
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export const AlertRef = React.createRef<AlertContextProps>();

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AlertState>({
    isOpen: false,
    message: '',
    title: '',
    type: 'info',
    isConfirm: false,
  });

  const showAlert = (title: string, message: string, type: AlertType = 'info') => {
    setState({ isOpen: true, title, message, type, isConfirm: false });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = 'Confirmar', cancelText = 'Cancelar') => {
    setState({ isOpen: true, title, message, type: 'warning', isConfirm: true, onConfirm, confirmText, cancelText });
  };

  const showOptions = (title: string, message: string, buttons: AlertButton[]) => {
    setState({ isOpen: true, title, message, type: 'info', buttons });
  };

  const handleClose = () => {
    setState(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = () => {
    if (state.onConfirm) state.onConfirm();
    handleClose();
  };

  React.useImperativeHandle(AlertRef, () => ({ showAlert, showConfirm, showOptions }));

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, showOptions }}>
      {children}
      <Modal transparent visible={state.isOpen} animationType="fade" onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.content}>
            {!!state.title && <Text style={styles.title}>{state.title}</Text>}
            <Text style={styles.message}>{state.message}</Text>
            
            {state.buttons && state.buttons.length > 0 ? (
              <View style={[styles.buttonRow, { flexDirection: state.buttons.length > 2 ? 'column' : 'row' }]}>
                {state.buttons.map((btn, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.button,
                      btn.style === 'cancel' ? styles.cancelButton : styles.confirmButton,
                      btn.style === 'destructive' && { backgroundColor: colors.danger }
                    ]}
                    onPress={() => {
                      if (btn.onPress) btn.onPress();
                      handleClose();
                    }}
                  >
                    <Text style={btn.style === 'cancel' ? styles.cancelText : styles.confirmText}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.buttonRow}>
                {state.isConfirm && (
                  <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleClose}>
                    <Text style={styles.cancelText}>{state.cancelText || 'Cancelar'}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={[
                    styles.button, 
                    styles.confirmButton, 
                    (state.type === 'error' || state.type === 'warning') && { backgroundColor: colors.danger }
                  ]} 
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmText}>{state.isConfirm ? state.confirmText || 'Confirmar' : 'OK'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlert must be used within an AlertProvider');
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.l,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    padding: spacing.l,
    width: '100%',
    maxWidth: 400,
    ...shadows.medium,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.s,
    textAlign: 'center',
  },
  message: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.l,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.m,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  cancelText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 15,
    color: colors.text,
  },
  confirmText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 15,
    color: colors.surface,
  },
});
