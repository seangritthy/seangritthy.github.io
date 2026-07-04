// ===== WEB3 WALLET AUTHENTICATION =====
// Supports: MetaMask wallet authentication
// Uses MetaMask's detect-provider when available.

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

    async detectProvider(options = {}) {
        const { mustBeMetaMask = false, silent = false, timeout = 500 } = options;

        if (typeof mustBeMetaMask !== 'boolean') {
            throw new Error('detect-provider: Expected option "mustBeMetaMask" to be a boolean.');
        }
        if (typeof silent !== 'boolean') {
            throw new Error('detect-provider: Expected option "silent" to be a boolean.');
        }
        if (typeof timeout !== 'number') {
            throw new Error('detect-provider: Expected option "timeout" to be a number.');
        }

        if (typeof window === 'undefined') return null;

        let handled = false;

        return new Promise((resolve) => {
            if (window.ethereum) {
                handleEthereum();
            } else {
                window.addEventListener(
                    'ethereum#initialized',
                    handleEthereum,
                    { once: true }
                );

                setTimeout(() => {
                    handleEthereum();
                }, timeout);
            }

            function handleEthereum() {
                if (handled) return;
                handled = true;

                window.removeEventListener('ethereum#initialized', handleEthereum);

                const { ethereum } = window;

                if (ethereum && (!mustBeMetaMask || ethereum.isMetaMask)) {
                    resolve(ethereum);
                } else {
                    const message = mustBeMetaMask
                        ? 'Non-MetaMask provider detected.'
                        : 'Unable to detect window.ethereum.';

                    if (!silent) {
                        console.error('@metamask/detect-provider:', message);
                    }
                    resolve(null);
                }
            }
        });
    }

    async waitForEthereum(timeoutMs = 500) {
        const detected = await this.detectProvider({
            mustBeMetaMask: false,
            silent: true,
            timeout: timeoutMs
        });
        if (detected) return detected;

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
        const detected = await this.detectProvider({
            mustBeMetaMask: preferred === 'metamask',
            silent: true,
            timeout: 500
        });
        const injected = detected || await this.waitForEthereum();
        if (!injected && this.discoveredProviders.length === 0) return null;

        if (preferred === 'metamask') {
            return this.getMetaMaskProvider(injected);
        }
        if (preferred === 'trust') {
            return this.getTrustWalletProvider(injected) || injected;
        }
        return injected;
    }

    getProviderCandidates(preferred = 'any') {
        const candidates = [];
        const pushUnique = (provider) => {
            if (!provider) return;
            if (!candidates.includes(provider)) candidates.push(provider);
        };

        const injected = window.ethereum;
        const discovered = this.discoveredProviders.map((entry) => entry.provider);

        if (preferred === 'metamask') {
            pushUnique(this.getMetaMaskProvider(injected));
            discovered.forEach((p) => { if (p?.isMetaMask) pushUnique(p); });
            if (Array.isArray(injected?.providers)) {
                injected.providers.forEach((p) => { if (p?.isMetaMask) pushUnique(p); });
            }
        } else if (preferred === 'trust') {
            pushUnique(this.getTrustWalletProvider(injected));
            discovered.forEach((p) => { if (p?.isTrust || p?.isTrustWallet) pushUnique(p); });
            if (Array.isArray(injected?.providers)) {
                injected.providers.forEach((p) => { if (p?.isTrust || p?.isTrustWallet) pushUnique(p); });
            }
        }

        discovered.forEach(pushUnique);
        if (Array.isArray(injected?.providers)) injected.providers.forEach(pushUnique);
        pushUnique(injected);
        return candidates;
    }

    getMetaMaskDeepLinks(targetUrl = null) {
        const url = new URL(targetUrl || window.location.href, window.location.origin);
        const dappPath = `${url.host}${url.pathname}${url.search}${url.hash}`;
        return {
            native: `metamask://dapp/${dappPath}`,
            universal: `https://metamask.app.link/dapp/${dappPath}`,
            universalEncoded: `https://metamask.app.link/dapp/${encodeURIComponent(dappPath)}`
        };
    }

    getMetaMaskDeepLink(targetUrl = null) {
        return this.getMetaMaskDeepLinks(targetUrl).universal;
    }

    isProbablyMobile() {
        const ua = String(navigator?.userAgent || '').toLowerCase();
        return /android|iphone|ipad|ipod|mobile/.test(ua);
    }

    isInsideMetaMaskApp() {
        const ua = String(navigator?.userAgent || '').toLowerCase();
        return ua.includes('metamaskmobile');
    }

    isMetaMaskInternalError(error) {
        const message = String(
            error?.data?.originalError?.message ||
            error?.data?.message ||
            error?.message ||
            ''
        ).toLowerCase();
        return error?.code === -32603 || message.includes('internal error');
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async requestWithInternalRetry(provider, payload, retries = 2, delayMs = 450) {
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
                return await provider.request(payload);
            } catch (error) {
                lastError = error;
                if (!this.isMetaMaskInternalError(error) || attempt === retries) {
                    throw error;
                }
                await this.sleep(delayMs * (attempt + 1));
            }
        }
        throw lastError || new Error('MetaMask request failed');
    }

    async requestMetaMaskAccounts(provider) {
        try {
            return await this.requestWithInternalRetry(provider, { method: 'eth_requestAccounts' }, 2, 500);
        } catch (error) {
            if (error?.code === 4001) throw error;

            // If MetaMask says internal error, try reading already-connected accounts first.
            if (this.isMetaMaskInternalError(error)) {
                try {
                    const existing = await this.requestWithInternalRetry(provider, { method: 'eth_accounts' }, 1, 350);
                    if (Array.isArray(existing) && existing.length) return existing;
                } catch (_) {
                    // Continue to permission retry.
                }
            }

            // Retry through wallet permissions for providers that require explicit grant first.
            try {
                await provider.request({
                    method: 'wallet_requestPermissions',
                    params: [{ eth_accounts: {} }]
                });
                const retried = await this.requestWithInternalRetry(provider, { method: 'eth_requestAccounts' }, 1, 450);
                if (Array.isArray(retried) && retried.length) return retried;
            } catch (_) {
                // Ignore and rethrow original error below.
            }

            throw error;
        }
    }

    openMetaMaskApp(targetUrl = null) {
        const links = this.getMetaMaskDeepLinks(targetUrl);

        // Already in MetaMask browser, no need to deep-link again.
        if (window.ethereum?.isMetaMask) return;

        let hidden = document.visibilityState === 'hidden';
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') hidden = true;
        };
        document.addEventListener('visibilitychange', onVisibilityChange, { once: true });

        // Try native scheme first; then fallback to universal links.
        window.location.href = links.native;
        setTimeout(() => {
            if (!hidden) window.location.href = links.universal;
        }, 700);
        setTimeout(() => {
            if (!hidden) window.location.href = links.universalEncoded;
        }, 1600);
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

        const messageHex = `0x${Array.from(new TextEncoder().encode(message))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')}`;

        const attempts = [
            [messageHex, address],
            [message, address],
            [address, messageHex],
            [address, message]
        ];

        for (const params of attempts) {
            try {
                const signature = await eth.request({
                    method: 'personal_sign',
                    params
                });
                this.signature = signature;
                this.signatureMessage = message;
                this.signedAt = issuedAt;
                return signature;
            } catch (error) {
                // Try next variant if wallet/provider is strict about param shape.
            }
        }

        console.error('Signature request failed after retries.');
        return null;
    }

    getErrorMessage(error, fallback) {
        const message =
            error?.data?.originalError?.message ||
            error?.data?.message ||
            error?.message ||
            fallback;

        if (error?.code === 4001) return 'Request was rejected in wallet.';
        if (error?.code === -32002) return 'MetaMask already has a pending request. Open MetaMask and complete it first.';
        if (this.isMetaMaskInternalError(error)) return 'MetaMask internal error. Open MetaMask app/browser and try again.';
        return String(message || fallback);
    }

    async syncWalletState(address, providerName, provider) {
        const eth = provider || this.ethereum || window.ethereum;
        if (!eth) throw new Error('No Ethereum provider found');

        this.ethereum = eth;
        this.address = address;
        this.provider = providerName || this.provider || 'Web3 Wallet';

        const chainId = await this.requestWithInternalRetry(eth, { method: 'eth_chainId' }, 2, 350);
        this.chainId = parseInt(chainId, 16);
        this.chainName = this.getChainName(this.chainId);

        const balanceWei = await this.requestWithInternalRetry(eth, {
            method: 'eth_getBalance',
            params: [this.address, 'latest']
        }, 2, 350);
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
            await this.waitForEthereum();
            let eth = await this.resolveProvider('metamask');
            const providerCandidates = this.getProviderCandidates('metamask')
                .filter((provider) => !!provider?.isMetaMask || provider === eth);
            if (eth && !providerCandidates.includes(eth)) providerCandidates.unshift(eth);

            if (!providerCandidates.length) {
                this.openMetaMaskApp();
                return null;
            }

            let accounts = null;
            let lastError = null;
            let sawInternalMetaMaskError = false;
            for (const provider of providerCandidates) {
                try {
                    const nextAccounts = await this.requestMetaMaskAccounts(provider);
                    if (Array.isArray(nextAccounts) && nextAccounts.length) {
                        eth = provider;
                        accounts = nextAccounts;
                        break;
                    }
                } catch (error) {
                    lastError = error;
                    if (error?.code === 4001) throw error;
                    if (this.isMetaMaskInternalError(error)) sawInternalMetaMaskError = true;
                }
            }

            if (!eth) {
                this.openMetaMaskApp();
                return null;
            }

            if (!accounts || !accounts.length) {
                if (sawInternalMetaMaskError && this.isProbablyMobile()) {
                    this.openMetaMaskApp();
                    return null;
                }
                throw lastError || new Error('No wallet account returned');
            }

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
            if (this.isMetaMaskInternalError(error)) {
                alert('MetaMask app returned a temporary internal error. Please tap Connect again.');
                return null;
            }
            alert('Failed to connect MetaMask: ' + this.getErrorMessage(error, 'Unknown wallet error'));
            return null;
        }
    }

    // Quick connect for app-redirect flow: skips signature for speed
    async connectMetaMaskQuick() {
        try {
            await this.waitForEthereum();
            let eth = await this.resolveProvider('metamask');
            const providerCandidates = this.getProviderCandidates('metamask')
                .filter((provider) => !!provider?.isMetaMask || provider === eth);
            if (eth && !providerCandidates.includes(eth)) providerCandidates.unshift(eth);

            if (!providerCandidates.length) return null;

            for (const provider of providerCandidates) {
                try {
                    const nextAccounts = await this.requestMetaMaskAccounts(provider);
                    if (Array.isArray(nextAccounts) && nextAccounts.length) {
                        eth = provider;
                        await this.syncWalletState(nextAccounts[0], 'MetaMask', eth);
                        return this.buildWalletData();
                    }
                } catch (error) {
                    if (error?.code === 4001) throw error;
                }
            }
            return null;
        } catch (error) {
            console.error('MetaMask quick connect error:', error);
            return null;
        }
    }

    async connectLocalProfile() {
        let storedLocal = localStorage.getItem('local_profile_wallet');
        let walletData;
        let addr = null;
        if (storedLocal) {
            addr = JSON.parse(storedLocal).address;
        }

        const inputAddr = prompt("Enter your Ethereum Wallet Address (0x...) to create your profile:", addr || "0x");
        if (inputAddr === null) return null;
        const cleanAddr = inputAddr.trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddr)) {
            alert("Invalid Ethereum address format!");
            return null;
        }

        const bal = (Math.random() * 10 + 2).toFixed(4);
        walletData = {
            address: cleanAddr,
            balance: bal,
            chainId: 137,
            chainName: 'Polygon Mainnet',
            provider: 'In-App Profile',
            signature: 'mock_signature_' + Math.floor(Math.random() * 1000000),
            signatureMessage: 'In-App Profile Authorization',
            signedAt: new Date().toISOString(),
            shortAddress: `${cleanAddr.slice(0, 6)}...${cleanAddr.slice(-4)}`
        };
        localStorage.setItem('local_profile_wallet', JSON.stringify(walletData));

        this.address = walletData.address;
        this.balance = walletData.balance;
        this.chainId = walletData.chainId;
        this.chainName = walletData.chainName;
        this.provider = walletData.provider;
        this.signature = walletData.signature;
        this.signatureMessage = walletData.signatureMessage;
        this.signedAt = walletData.signedAt;
        return walletData;
    }

    // Compatibility stub: Trust Wallet login is disabled (MetaMask-only policy).
    async connectTrustWallet() {
        alert('Only MetaMask is supported for wallet login.');
        return null;
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
        if (!!this.address) return true;
        try {
            const stored = localStorage.getItem('g_user');
            if (stored) {
                const data = JSON.parse(stored);
                if (data && data.address) return true;
            }
        } catch (e) {}
        return false;
    }

    // Get wallet data
    getWalletData() {
        if (this.address) return this.buildWalletData();
        try {
            const stored = localStorage.getItem('g_user');
            if (stored) {
                const data = JSON.parse(stored);
                if (data && data.address) return data;
            }
        } catch (e) {}
        return this.buildWalletData();
    }
}

// Expose class + singleton for pages that initialize in different script orders.
window.Web3Auth = Web3Auth;
if (!window.web3Auth) {
    window.web3Auth = new Web3Auth();
}
