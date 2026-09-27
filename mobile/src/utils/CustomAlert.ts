import { AlertRef } from '../context/AlertContext';

export const CustomAlert = {
  alert: (title: string, message: string, buttons?: any[]) => {
    if (buttons && buttons.length > 0) {
      if (buttons.length > 2) {
        AlertRef.current?.showOptions(title, message, buttons);
        return;
      }

      // Find confirm button
      const confirmBtn = buttons.find(b => b.text !== 'Cancelar' && b.style !== 'cancel');
      // Find cancel button
      const cancelBtn = buttons.find(b => b.text === 'Cancelar' || b.style === 'cancel');

      if (confirmBtn && cancelBtn) {
        // It's a confirm dialog
        AlertRef.current?.showConfirm(
          title, 
          message, 
          confirmBtn.onPress || (() => {}), 
          confirmBtn.text, 
          cancelBtn.text
        );
      } else if (confirmBtn) {
        // Just one button, treat as info/error depending on title maybe, or just alert
        const type = title.toLowerCase().includes('erro') ? 'error' : 'info';
        AlertRef.current?.showConfirm(
          title, 
          message, 
          confirmBtn.onPress || (() => {}), 
          confirmBtn.text, 
          '' // Empty cancel text to hide cancel button?
        );
      }
    } else {
      const type = title.toLowerCase().includes('erro') ? 'error' : 'info';
      AlertRef.current?.showAlert(title, message, type);
    }
  }
};
