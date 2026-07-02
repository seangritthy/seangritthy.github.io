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
    }

    // Check if wallet is available
    isMetaMaskAvailable() {
        return typeof window.ethereum !== 'undefined';
    }

    async requestSignature(address) {
        if (!window.ethereum || !address) return null;
        const issuedAt = new Date().toISOString();
        const message = [
            'GitHub Movies Wallet Login',
            `Address: ${address}`,
            `Domain: ${window.location.host}`,
            `Issued At: ${issuedAt}`
        ].join('\n');

        try {
            const signature = await window.ethereum.request({
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

    async syncWalletState(address, providerName) {
        this.address = address;
        this.provider = providerName || this.provider || 'Web3 Wallet';

        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        this.chainId = parseInt(chainId, 16);
        this.chainName = this.getChainName(this.chainId);

        const balanceWei = await window.ethereum.request({
            method: 'eth_getBalance',
            params: [this.address, 'latest']
        });
        this.balance = (parseInt(balanceWei, 16) / 1e18).toFixed(4);
        this.setupEventListeners();
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
            if (!this.isMetaMaskAvailable()) {
                alert('MetaMask is not installed. Please install it to continue.');
                window.open('https://metamask.io', '_blank');
                return null;
            }

            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });
            if (!accounts || !accounts.length) return null;

            await this.syncWalletState(accounts[0], 'MetaMask');

            // Require a signature so login proves wallet ownership.
            const signature = await this.requestSignature(this.address);
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
            if (!this.isMetaMaskAvailable()) {
                alert('Trust Wallet is not available. Please open this in Trust Wallet app or install MetaMask.');
                return null;
            }

            // Trust Wallet works through MetaMask API
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });
            if (!accounts || !accounts.length) return null;

            await this.syncWalletState(accounts[0], 'Trust Wallet');

            const signature = await this.requestSignature(this.address);
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
        if (!window.ethereum) return null;

        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (!accounts || !accounts.length) return null;

            const connectedAddress = accounts[0];
            if (expectedAddress && connectedAddress.toLowerCase() !== String(expectedAddress).toLowerCase()) {
                return null;
            }

            await this.syncWalletState(connectedAddress, this.provider || 'Web3 Wallet');
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
    setupEventListeners() {
        if (window.ethereum) {
            if (this._listenersAttached) return;
            // Account change
            window.ethereum.on('accountsChanged', (accounts) => {
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
            window.ethereum.on('chainChanged', (chainId) => {
                console.log('Chain changed:', chainId);
                this.chainId = parseInt(chainId, 16);
                this.chainName = this.getChainName(this.chainId);
                this.refreshBalance();
                window.dispatchEvent(new CustomEvent('walletChainChanged', { detail: { chainId: this.chainId, chainName: this.chainName } }));
            });

            // Disconnect
            window.ethereum.on('disconnect', () => {
                console.log('Wallet disconnected');
                this.disconnect();
            });

            this._listenersAttached = true;
        }
    }

    // Refresh balance
    async refreshBalance() {
        if (!this.address) return;

        try {
            const balanceWei = await window.ethereum.request({
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
