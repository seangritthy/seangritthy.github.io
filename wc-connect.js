/**
 * wc-connect.js — WalletConnect v2 integration for GitHub Movies
 *
 * How it works:
 *  1. User taps "Connect MetaMask"
 *  2. WalletConnect EthereumProvider initialises (via CDN, no build step)
 *  3. provider.enable() triggers the WalletConnect QR modal INSIDE the WebView
 *  4. User opens MetaMask → scans QR or taps "Open MetaMask" deeplink
 *  5. MetaMask approves the session → WebSocket relay delivers accounts
 *  6. onConnected(walletData) callback fires — no page redirects needed
 *
 * Replace YOUR_WALLETCONNECT_PROJECT_ID with your free Project ID from:
 *   https://cloud.walletconnect.com
 */

const WC_PROJECT_ID = '1ff46d6d57a18d4bdc3c81a6bbecb5a0';

const WC_METADATA = {
    name: 'GitHub Movies',
    description: 'Watch movies authenticated with your MetaMask wallet',
    url: 'https://seangritthy.github.io',
    icons: ['https://seangritthy.github.io/logo.svg']
};

// Supported chain IDs
const WC_CHAINS = [1, 56, 137, 8453]; // Ethereum, BSC, Polygon, Base

let wcProvider = null;
let wcInitPromise = null;

/**
 * Load the WalletConnect EthereumProvider from CDN (once).
 */
async function loadWCProvider() {
    if (wcInitPromise) return wcInitPromise;

    wcInitPromise = (async () => {
        await loadScript('https://unpkg.com/@walletconnect/ethereum-provider@2.17.0/dist/index.umd.js');

        const EthereumProvider = window.EthereumProvider?.EthereumProvider || window.EthereumProvider;
        if (!EthereumProvider) {
            throw new Error('WalletConnect EthereumProvider not found after script load');
        }

        const provider = await EthereumProvider.init({
            projectId: WC_PROJECT_ID,
            chains: WC_CHAINS,
            optionalChains: WC_CHAINS,
            showQrModal: true,
            qrModalOptions: {
                themeMode: 'dark',
                themeVariables: {
                    '--wcm-background-color': '#0f172a',
                    '--wcm-accent-color': '#8b5cf6',
                    '--wcm-z-index': '9999'
                },
                explorerRecommendedWalletIds: [
                    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
                ],
                enableExplorer: true,
            },
            metadata: WC_METADATA
        });

        provider.on('disconnect', () => {
            wcProvider = null;
            window.dispatchEvent(new CustomEvent('wcDisconnected'));
        });

        provider.on('accountsChanged', (accounts) => {
            window.dispatchEvent(new CustomEvent('wcAccountsChanged', { detail: accounts }));
        });

        provider.on('chainChanged', (chainId) => {
            window.dispatchEvent(new CustomEvent('wcChainChanged', { detail: chainId }));
        });

        return provider;
    })();

    return wcInitPromise;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(script);
    });
}

/**
 * Connect via WalletConnect. Opens QR modal inside the app.
 */
async function connectWalletConnect(onConnected, onError) {
    try {
        const provider = await loadWCProvider();
        wcProvider = provider;

        if (provider.session) {
            try { await provider.disconnect(); } catch (_) {}
        }

        await provider.enable();

        const accounts = await provider.request({ method: 'eth_accounts' });
        if (!accounts || !accounts.length) throw new Error('No accounts returned');

        const address = accounts[0];
        const chainIdHex = await provider.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex, 16);

        let balance = '0.0000';
        try {
            const balWei = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
            balance = (parseInt(balWei, 16) / 1e18).toFixed(4);
        } catch (_) {}

        const walletData = {
            address,
            balance,
            chainId,
            chainName: getWCChainName(chainId),
            shortAddress: `${address.slice(0, 6)}...${address.slice(-4)}`,
            provider: 'MetaMask (WalletConnect)',
            wcProvider: provider
        };

        if (typeof onConnected === 'function') onConnected(walletData);
        return walletData;

    } catch (error) {
        const msg = error?.message || String(error);
        if (msg.includes('User rejected') || msg.includes('cancelled') || msg.includes('closed') || msg.includes('Modal closed')) {
            return null;
        }
        console.error('WalletConnect error:', error);
        if (typeof onError === 'function') onError(msg);
        return null;
    }
}

async function disconnectWalletConnect() {
    if (wcProvider && wcProvider.session) {
        try { await wcProvider.disconnect(); } catch (_) {}
    }
    wcProvider = null;
    wcInitPromise = null;
}

function getWCProvider() { return wcProvider; }

function getWCChainName(chainId) {
    const names = {
        1: 'Ethereum', 5: 'Goerli', 11155111: 'Sepolia',
        56: 'BNB Smart Chain', 97: 'BSC Testnet',
        137: 'Polygon', 80001: 'Mumbai',
        8453: 'Base', 42161: 'Arbitrum One', 10: 'Optimism'
    };
    return names[chainId] || `Network ${chainId}`;
}

window.WCConnect = {
    connect: connectWalletConnect,
    disconnect: disconnectWalletConnect,
    getProvider: getWCProvider,
    isReady: () => !!(wcProvider && wcProvider.session)
};
