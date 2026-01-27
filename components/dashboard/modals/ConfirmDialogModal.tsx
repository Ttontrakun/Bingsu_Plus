import React from 'react';

interface ConfirmDialog {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

interface ConfirmDialogModalProps {
  dialog: ConfirmDialog | null;
  onClose: () => void;
}

const ConfirmDialogModal: React.FC<ConfirmDialogModalProps> = ({ dialog, onClose }) => {
  if (!dialog) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gem-slate p-6 rounded-xl w-full max-w-md border border-gem-mist/40">
        <h3 className="text-lg font-semibold mb-2">{dialog.title}</h3>
        <p className="text-sm text-gem-offwhite/70 mb-6">{dialog.message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gem-mist hover:bg-gem-mist/70 text-gem-offwhite font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const action = dialog.onConfirm;
              onClose();
              action();
            }}
            className="px-4 py-2 rounded-md bg-gem-blue hover:bg-blue-500 text-white font-semibold"
          >
            {dialog.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialogModal;
