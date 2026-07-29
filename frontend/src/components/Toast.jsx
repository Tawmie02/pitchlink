import React, { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "success") => {
      const id = ++idCounter;
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 rounded-xl border shadow-card px-4 py-3 bg-white animate-in slide-in-from-bottom-2 ${
              t.type === "error" ? "border-red-200" : t.type === "info" ? "border-stone-200" : "border-pitch-200"
            }`}
          >
            {t.type === "error" ? (
              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            ) : t.type === "info" ? (
              <Info className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-pitch-600 shrink-0 mt-0.5" />
            )}
            <p className="text-sm text-stone-700 flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-stone-400 hover:text-stone-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
