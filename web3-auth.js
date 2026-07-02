// ===== WEB3 WALLET AUTHENTICATION =====
// Supports: MetaMask, Trust Wallet, and other EVM-compatible wallets

class Web3Auth {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.balance = null;
        this.chainId = null;
        this.chainName = null;
        this.signature = null;
        this.signatureMessage = null;
        this.signedAt = null;
        this._listenersAttached = false;
        this.ethereum = null;
        this.discoveredProviders = [];
        this.discoveryInitialized = false;
        this.initProviderDiscovery();
    }

    initProviderDiscovery() {
        if (this.discoveryInitialized || typeof window === 'undefined') return;
        this.discoveryInitialized = true;

        const seen = new Set();
        window.addEventListener('eip6963:announceProvider', (event) => {
            const detail = event?.detail;
            const provider = detail?.provider;
            const info = detail?.info || {};
            const key = info.uuid || info.rdns || info.name || String(this.discoveredProviders.length);

            if (!provider || seen.has(key)) return;
            seen.add(key);
            this.discoveredProviders.push({ provider, info });
        });

        try {
            window.dispatchEvent(new Event('eip6963:requestProvider'));
        } catch (error) {
            console.warn('EIP-6963 provider discovery not available:', error);
        }
    }

    getDiscoveredProvider(predicate) {
        const found = this.discoveredProviders.find((entry) => {
            try {
                return predicate(entry.provider, entry.info || {});
            } catch (_) {
                return false;
            }
        });
        return found ? found.provider : null;
    }

    // Check if wallet is available
    isMetaMaskAvailable() {
        return typeof window.ethereum !== 'undefined';
    }

    async waitForEthereum(timeoutMs = 6000) {
        if (window.ethereum) return window.ethereum;

        return new Promise((resolve) => {
            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                resolve(value || null);
            };

            const onInit = () => finish(window.ethereum || null);
            window.addEventListener('ethereum#initialized', onInit, { once: true });
            setTimeout(() => finish(window.ethereum || null), timeoutMs);
        });
    }

    getMetaMaskProvider(ethereum) {
        const discovered = this.getDiscoveredProvider((provider, info) => {
            const rdns = String(info.rdns || '').toLowerCase();
            const name = String(info.name || '').toLowerCase();
            return !!provider?.isMetaMask || rdns.includes('metamask') || name.includes('metamask');
        });
        if (discovered) return discovered;

        if (!ethereum) return null;
        if (ethereum.isMetaMask) return ethereum;
        if (Array.isArray(ethereum.providers)) {
            return ethereum.providers.find((p) => !!p?.isMetaMask) || null;
        }
        return null;
    }

    getTrustWalletProvider(ethereum) {
        const discovered = this.getDiscoveredProvider((provider, info) => {
            const rdns = String(info.rdns || '').toLowerCase();
            const name = String(info.name || '').toLowerCase();
            return !!(provider?.isTrust || provider?.isTrustWallet) || rdns.includes('trustwallet') || name.includes('trust wallet');
        });
        if (discovered) return discovered;

        if (!ethereum) return null;
        if (ethereum.isTrust || ethereum.isTrustWallet) return ethereum;
        if (Array.isArray(ethereum.providers)) {
            return ethereum.providers.find((p) => !!(p?.isTrust || p?.isTrustWallet)) || null;
        }
        return null;
    }

    async resolveProvider(preferred = 'any') {
        this.initProviderDiscovery();
        const injected = await this.waitForEthereum();
        if (!injected && this.discoveredProviders.length === 0) return null;

        if (preferred === 'metamask') {
            return this.getMetaMaskProvider(injected);
        }
        if (preferred === 'trust') {
            return this.getTrustWalletProvider(injected) || injected;
        }
        return injected;
    }

    getMetaMaskDeepLink() {
        const currentUrl = window.location.href;
        const normalized = currentUrl.replace(/^https?:\/\//, '');
        return `https://metamask.app.link/dapp/${normalized}`;
    }

    async requestSignature(address, provider) {
        const eth = provider || this.ethereum || window.ethereum;
        if (!eth || !address) return null;
        const issuedAt = new Date().toISOString();
        const message = [
            'GitHub Movies Wallet Login',
            `Address: ${address}`,
            `Domain: ${window.location.host}`,
            `Issued At: ${issuedAt}`
        ].join('\n');

        try {
            const signature = await eth.request({
                method: 'personal_sign',
                params: [message, address]
            });
            this.signature = signature;
            this.signatureMessage = message;
            this.signedAt = issuedAt;
            return signature;
        } catch (error) {
            console.error('Signature request failed:', error);
            return null;
        }
    }

    async syncWalletState(address, providerName, provider) {
        const eth = provider || this.ethereum || window.ethereum;
        if (!eth) throw new Error('No Ethereum provider found');

        this.ethereum = eth;
        this.address = address;
        this.provider = providerName || this.provider || 'Web3 Wallet';

        const chainId = await eth.request({ method: 'eth_chainId' });
        this.chainId = parseInt(chainId, 16);
        this.chainName = this.getChainName(this.chainId);

        const balanceWei = await eth.request({
            method: 'eth_getBalance',
            params: [this.address, 'latest']
        });
        this.balance = (parseInt(balanceWei, 16) / 1e18).toFixed(4);
        this.setupEventListeners(eth);
    }

    buildWalletData() {
        return {
            address: this.address,
            balance: this.balance,
            chainId: this.chainId,
            chainName: this.chainName,
            provider: this.provider,
            signature: this.signature,
            signatureMessage: this.signatureMessage,
            signedAt: this.signedAt,
            shortAddress: this.getShortAddress()
        };
    }

    // Connect to MetaMask
    async connectMetaMask() {
        try {
            let eth = await this.resolveProvider('metamask');
            if (!eth) {
                // Fallback for browsers/extensions that do not expose MetaMask flags reliably.
                eth = await this.resolveProvider('any');
            }
            if (!eth) {
                const deepLink = this.getMetaMaskDeepLink();
                alert('MetaMask is not available in this browser context. Opening MetaMask app browser now.');
                window.open(deepLink, '_blank');
                return null;
            }

            // Request account access
            const accounts = await eth.request({
                method: 'eth_requestAccounts'
            });
            if (!accounts || !accounts.length) return null;

            const providerName = eth.isMetaMask ? 'MetaMask' : 'Injected Wallet';
            await this.syncWalletState(accounts[0], providerName, eth);

            // Require a signature so login proves wallet ownership.
            const signature = await this.requestSignature(this.address, eth);
            if (!signature) {
                alert('Wallet signature is required to log in.');
                this.disconnect();
                return null;
            }

            return this.buildWalletData();
        } catch (error) {
            console.error('MetaMask connection error:', error);
            alert('Failed to connect MetaMask: ' + error.message);
            return null;
        }
    }

    // Connect to Trust Wallet (via WalletConnect or direct)
    async connectTrustWallet() {
        try {
            const eth = await this.resolveProvider('trust');
            if (!eth) {
                alert('Trust Wallet is not available. Please open this in Trust Wallet app or install MetaMask.');
                return null;
            }

            // Trust Wallet works through MetaMask API
            const accounts = await eth.request({
                method: 'eth_requestAccounts'
            });
            if (!accounts || !accounts.length) return null;

            await this.syncWalletState(accounts[0], 'Trust Wallet', eth);

            const signature = await this.requestSignature(this.address, eth);
            if (!signature) {
                alert('Wallet signature is required to log in.');
                this.disconnect();
                return null;
            }

            return this.buildWalletData();
        } catch (error) {
            console.error('Trust Wallet connection error:', error);
            alert('Failed to connect Trust Wallet: ' + error.message);
            return null;
        }
    }

    async restoreSession(expectedAddress = null) {
        const preferred = this.provider === 'MetaMask' ? 'metamask' : 'any';
        const eth = (await this.resolveProvider(preferred)) || (await this.resolveProvider('any'));
        if (!eth) return null;

        try {
            const accounts = await eth.request({ method: 'eth_accounts' });
            if (!accounts || !accounts.length) return null;

            const connectedAddress = accounts[0];
            if (expectedAddress && connectedAddress.toLowerCase() !== String(expectedAddress).toLowerCase()) {
                return null;
            }

            await this.syncWalletState(connectedAddress, this.provider || 'Web3 Wallet', eth);
            return this.buildWalletData();
        } catch (error) {
            console.error('Restore session failed:', error);
            return null;
        }
    }

    // Get chain name from ID
    getChainName(chainId) {
        const chains = {
            1: 'Ethereum Mainnet',
            5: 'Ethereum Goerli',
            11155111: 'Ethereum Sepolia',
            137: 'Polygon Mainnet',
            80001: 'Polygon Mumbai',
            56: 'Binance Smart Chain',
            97: 'BSC Testnet',
            42161: 'Arbitrum One',
            10: 'Optimism',
            250: 'Fantom',
            43114: 'Avalanche C-Chain'
        };
        return chains[chainId] || `Network ${chainId}`;
    }

    // Set up wallet event listeners
    setupEventListeners(provider) {
        const eth = provider || this.ethereum || window.ethereum;
        if (eth) {
            if (this._listenersAttached) return;
            // Account change
            eth.on('accountsChanged', (accounts) => {
                console.log('Account changed:', accounts);
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    this.address = accounts[0];
                    this.refreshBalance();
                    window.dispatchEvent(new CustomEvent('walletAccountChanged', { detail: this.address }));
                }
            });

            // Chain change
            eth.on('chainChanged', (chainId) => {
                console.log('Chain changed:', chainId);
                this.chainId = parseInt(chainId, 16);
                this.chainName = this.getChainName(this.chainId);
                this.refreshBalance();
                window.dispatchEvent(new CustomEvent('walletChainChanged', { detail: { chainId: this.chainId, chainName: this.chainName } }));
            });

            // Disconnect
            eth.on('disconnect', () => {
                console.log('Wallet disconnected');
                this.disconnect();
            });

            this._listenersAttached = true;
        }
    }

    // Refresh balance
    async refreshBalance() {
        if (!this.address) return;

        const eth = this.ethereum || window.ethereum;
        if (!eth) return;

        try {
            const balanceWei = await eth.request({
                method: 'eth_getBalance',
                params: [this.address, 'latest']
            });
            this.balance = (parseInt(balanceWei, 16) / 1e18).toFixed(4);
            return this.balance;
        } catch (error) {
            console.error('Error refreshing balance:', error);
        }
    }

    // Disconnect wallet
    disconnect() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.balance = null;
        this.chainId = null;
        this.chainName = null;
        this.signature = null;
        this.signatureMessage = null;
        this.signedAt = null;
        this.ethereum = null;
    }

    // Get short address (0x1234...5678)
    getShortAddress(addr = this.address) {
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }

    // Check if connected
    isConnected() {
        return !!this.address;
    }

    // Get wallet data
    getWalletData() {
        return this.buildWalletData();
    }
}

// Expose class + singleton for pages that initialize in different script orders.
window.Web3Auth = Web3Auth;
if (!window.web3Auth) {
    window.web3Auth = new Web3Auth();
}
