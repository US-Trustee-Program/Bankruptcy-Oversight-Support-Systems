import { createContext, useContext, useState } from 'react';

const FORM_LIST_KEY = 'savedFormKeys';

interface FormStorageContext {
  saveForm: (formKey: string, data: object) => void;
  getForm: (formKey: string) => object;
  clearForm: (formKey: string) => void;
  formKeys: string[];
}

const FormStorageContext = createContext<FormStorageContext | undefined>(undefined);

export const FormStorageProvider = ({ children }: { children: React.ReactNode }) => {
  const [formKeys, setFormKeys] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem(FORM_LIST_KEY) || '[]');
  });

  const saveForm = (formKey: string, data: object) => {
    localStorage.setItem(formKey, JSON.stringify(data));

    setFormKeys((prevKeys) => {
      if (!prevKeys.includes(formKey)) {
        const newKeys = [...prevKeys, formKey];
        localStorage.setItem(FORM_LIST_KEY, JSON.stringify(newKeys));
        return newKeys;
      }
      return prevKeys;
    });
  };

  const getForm = (formKey: string): object => {
    return JSON.parse(localStorage.getItem(formKey) || 'null');
  };

  const clearForm = (formKey: string) => {
    localStorage.removeItem(formKey);

    setFormKeys((prevKeys) => {
      const newKeys = prevKeys.filter((key) => key !== formKey);
      localStorage.setItem(FORM_LIST_KEY, JSON.stringify(newKeys));
      return newKeys;
    });
  };

  return (
    <FormStorageContext.Provider value={{ saveForm, getForm, clearForm, formKeys }}>
      {children}
    </FormStorageContext.Provider>
  );
};

export const useFormStorage = () => {
  const context = useContext(FormStorageContext);
  if (!context) {
    throw new Error('Form management provider error');
  }
  return context;
};
