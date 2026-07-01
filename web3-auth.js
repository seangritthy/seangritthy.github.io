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
    }

    // Check if wallet is available
    isMetaMaskAvailable() {
        return typeof window.ethereum !== 'undefined';
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

            this.address = accounts[0];

            // Get network info
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            this.chainId = parseInt(chainId, 16);
            this.chainName = this.getChainName(this.chainId);

            // Get balance
            const balanceWei = await window.ethereum.request({
                method: 'eth_getBalance',
                params: [this.address, 'latest']
            });

            // Convert Wei to ETH (1 ETH = 10^18 Wei)
            this.balance = (parseInt(balanceWei, 16) / 1e18).toFixed(4);

            // Set up event listeners
            this.setupEventListeners();

            return {
                address: this.address,
                balance: this.balance,
                chainId: this.chainId,
                chainName: this.chainName,
                provider: 'MetaMask'
            };
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

            this.address = accounts[0];

            // Get network info
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            this.chainId = parseInt(chainId, 16);
            this.chainName = this.getChainName(this.chainId);

            // Get balance
            const balanceWei = await window.ethereum.request({
                method: 'eth_getBalance',
                params: [this.address, 'latest']
            });

            this.balance = (parseInt(balanceWei, 16) / 1e18).toFixed(4);
            this.setupEventListeners();

            return {
                address: this.address,
                balance: this.balance,
                chainId: this.chainId,
                chainName: this.chainName,
                provider: 'Trust Wallet'
            };
        } catch (error) {
            console.error('Trust Wallet connection error:', error);
            alert('Failed to connect Trust Wallet: ' + error.message);
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
        return {
            address: this.address,
            balance: this.balance,
            chainId: this.chainId,
            chainName: this.chainName,
            shortAddress: this.getShortAddress()
        };
    }
}

// Create global instance
const web3Auth = new Web3Auth();
