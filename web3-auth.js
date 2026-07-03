// web3-auth.js - MetaMask only
(function() {
    'use strict';

    class Web3Auth {
        constructor() {
            this.address = null;
            this.balance = null;
            this.chainId = null;
            this.chainName = 'Unknown';
            this.provider = 'MetaMask';
        }

        isMetaMaskInstalled() {
            return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
        }

        async connect() {
            if (!this.isMetaMaskInstalled()) {
                alert('MetaMask is not installed. Please install it from https://metamask.io/');
                return null;
            }

            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (!accounts || accounts.length === 0) {
                    throw new Error('No accounts found');
                }

                this.address = accounts[0];
                await this.updateChainInfo();
                await this.updateBalance();

                // Listen for account changes
                window.ethereum.on('accountsChanged', (newAccounts) => {
                    if (newAccounts.length > 0) {
                        this.address = newAccounts[0];
                        this.updateBalance();
                        if (this.onAccountChange) this.onAccountChange(this.address);
                    } else {
                        this.disconnect();
                    }
                });

                window.ethereum.on('chainChanged', () => {
                    window.location.reload();
                });

                return this.getWalletData();
            } catch (error) {
                console.error('MetaMask connection error:', error);
                if (error.code === 4001) {
                    alert('Connection rejected by user.');
                } else {
                    alert('Failed to connect to MetaMask. Please try again.');
                }
                return null;
            }
        }

        async updateChainInfo() {
            if (!this.isMetaMaskInstalled()) return;
            try {
                const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
                this.chainId = parseInt(chainIdHex, 16);
                const chainMap = {
                    1: 'Ethereum Mainnet',
                    5: 'Goerli',
                    11155111: 'Sepolia',
                    137: 'Polygon',
                    56: 'BSC',
                    43114: 'Avalanche'
                };
                this.chainName = chainMap[this.chainId] || `Chain ID ${this.chainId}`;
            } catch (e) {
                console.warn('Failed to get chain info:', e);
            }
        }

        async updateBalance() {
            if (!this.address || !this.isMetaMaskInstalled()) return;
            try {
                const wei = await window.ethereum.request({
                    method: 'eth_getBalance',
                    params: [this.address, 'latest']
                });
                this.balance = (parseInt(wei, 16) / 1e18).toFixed(4);
            } catch (e) {
                console.warn('Failed to get balance:', e);
                this.balance = '0.0000';
            }
        }

        disconnect() {
            this.address = null;
            this.balance = null;
            this.chainId = null;
            this.chainName = 'Unknown';
        }

        getWalletData() {
            if (!this.address) return null;
            return {
                provider: this.provider,
                address: this.address,
                shortAddress: `${this.address.slice(0, 6)}...${this.address.slice(-4)}`,
                balance: this.balance,
                chainId: this.chainId,
                chainName: this.chainName
            };
        }

        onAccountChange = null;
    }

    window.Web3Auth = Web3Auth;
    if (!window.web3Auth) {
        window.web3Auth = new Web3Auth();
    }
})();
