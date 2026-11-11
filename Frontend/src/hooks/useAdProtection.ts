'use client';

/**
 * Custom hook to implement a simple two-step click mechanism.
 * 1st click: Opens ad link.
 * 2nd click: Performs the real action.
 */
export const useAdProtection = () => {
    const isEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';
    const adLink = process.env.NEXT_PUBLIC_AD_LINK || 'https://www.profitablecpmratenetwork.com/w223zkew?key=b4ac6d7ae43301128f04c8395349d58d';

    const withAdProtection = (key: string, action: () => void) => {
        if (!isEnabled) {
            action();
            return;
        }

        const stateKey = `ad_clicked_${key}`;
        const hasClicked = sessionStorage.getItem(stateKey);

        if (hasClicked === 'true') {
            // 2nd Click: Reset state and perform real action
            sessionStorage.removeItem(stateKey);
            action();
        } else {
            // 1st Click: Mark as clicked and open ad
            sessionStorage.setItem(stateKey, 'true');
            window.open(adLink, '_blank');
        }
    };

    return { withAdProtection };
};
