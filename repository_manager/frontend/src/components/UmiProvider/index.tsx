// Umi provider for the useUmi hook
// Debashish Buragohain

import { Umi, createUmi } from '@metaplex-foundation/umi';
import { useState, createContext, useContext, ReactNode, FC } from 'react';

interface UmiContextState {
    umi: Umi,
    setUmi: (umi: Umi) => void;
}

const UmiContext = createContext<UmiContextState | null>(null);

export function useUmi(): UmiContextState {
    const context = useContext(UmiContext);
    if (!context) {
        throw new Error('useUmi must be used witihin a UmiProvider.');
    }
    return context;
}


// Umi Provider component
export const UmiProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // create a defalt umi
    const [umi, setUmi] = useState<Umi>(createUmi());
    return (
        <UmiContext.Provider value={{ umi, setUmi }}>
            {children}
        </UmiContext.Provider>
    )
}