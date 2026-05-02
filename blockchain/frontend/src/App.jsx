import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers';
import abi from './abi/DigitalItem.json';
import { CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID } from './config.js';

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);

  const [contract, setContract] = useState(null);
  const [contractOwner, setContractOwner] = useState(null);
  const [price, setPrice] = useState(null);
  const [purchaseCount, setPurchaseCount] = useState(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [contractBalance, setContractBalance] = useState(null);

  const [txStatus, setTxStatus] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const isOwner = account && contractOwner && account.toLowerCase() === contractOwner.toLowerCase();
  const isCorrectNetwork = chainId === SEPOLIA_CHAIN_ID;
  const hasMetaMask = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';

  const shortAddr = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';

  // ─── Load contract state ───
  const loadContractState = useCallback(async (contractInstance, userAddress, prov) => {
    try {
      const [ownerAddr, currentPrice, count, purchased] = await Promise.all([
        contractInstance.owner(),
        contractInstance.price(),
        contractInstance.purchaseCount(),
        contractInstance.hasPurchased(userAddress),
      ]);
      setContractOwner(ownerAddr);
      setPrice(currentPrice);
      setPurchaseCount(Number(count));
      setHasPurchased(purchased);

      if (prov) {
        const bal = await prov.getBalance(await contractInstance.getAddress());
        setContractBalance(bal);
      }
    } catch (err) {
      console.error('Failed to load contract state:', err);
      setTxStatus({ type: 'error', message: 'Failed to read contract — check if you are on Sepolia.' });
    }
  }, []);

  // ─── Connect wallet ───
  const connectWallet = async () => {
    if (!hasMetaMask) return;
    try {
      setTxStatus(null);
      const browserProvider = new BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      const network = await browserProvider.getNetwork();
      const currentChainId = '0x' + network.chainId.toString(16);

      setProvider(browserProvider);
      setAccount(accounts[0]);
      setChainId(currentChainId);

      if (currentChainId === SEPOLIA_CHAIN_ID) {
        const userSigner = await browserProvider.getSigner();
        setSigner(userSigner);
        const contractInstance = new Contract(CONTRACT_ADDRESS, abi, userSigner);
        setContract(contractInstance);
        await loadContractState(contractInstance, accounts[0], browserProvider);
      }
    } catch (err) {
      console.error('Connect failed:', err);
      setTxStatus({ type: 'error', message: 'Failed to connect wallet.' });
    }
  };

  // ─── Switch to Sepolia ───
  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: 'Sepolia Testnet',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://rpc.sepolia.org'],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          }],
        });
      }
    }
  };

  // ─── Buy ───
  const handleBuy = async () => {
    if (!contract || !price) return;
    setLoading(true);
    setTxStatus({ type: 'pending', message: 'Confirm the transaction in MetaMask…' });
    try {
      const tx = await contract.buy({ value: price });
      setTxStatus({ type: 'pending', message: `Transaction submitted. Waiting for confirmation…` });
      await tx.wait();
      setTxStatus({ type: 'success', message: 'Purchase complete!' });
      await loadContractState(contract, account, provider);
    } catch (err) {
      setTxStatus({ type: 'error', message: err?.reason || err?.shortMessage || 'Transaction failed.' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Update price (owner) ───
  const handleUpdatePrice = async () => {
    if (!contract || !newPrice) return;
    setLoading(true);
    setTxStatus({ type: 'pending', message: 'Updating price…' });
    try {
      const tx = await contract.updatePrice(parseEther(newPrice));
      await tx.wait();
      setTxStatus({ type: 'success', message: `Price updated to ${newPrice} ETH.` });
      setNewPrice('');
      await loadContractState(contract, account, provider);
    } catch (err) {
      setTxStatus({ type: 'error', message: err?.reason || err?.shortMessage || 'Update failed.' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Withdraw (owner) ───
  const handleWithdraw = async () => {
    if (!contract) return;
    setLoading(true);
    setTxStatus({ type: 'pending', message: 'Withdrawing funds…' });
    try {
      const tx = await contract.withdraw();
      await tx.wait();
      setTxStatus({ type: 'success', message: 'Withdrawal complete.' });
      await loadContractState(contract, account, provider);
    } catch (err) {
      setTxStatus({ type: 'error', message: err?.reason || err?.shortMessage || 'Withdrawal failed.' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Listeners ───
  useEffect(() => {
    if (!hasMetaMask) return;
    const onAccountsChanged = (accs) => {
      if (accs.length === 0) { setAccount(null); setContract(null); }
      else connectWallet();
    };
    const onChainChanged = () => window.location.reload();
    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum.removeListener('chainChanged', onChainChanged);
    };
  }, []);

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════

  // No MetaMask
  if (!hasMetaMask) {
    return (
      <div className="app">
        <Navbar account={null} onConnect={() => {}} />
        <main className="main">
          <div className="empty-state">
            <div className="empty-state__icon">🦊</div>
            <h2 className="empty-state__title">MetaMask Required</h2>
            <p className="empty-state__text">
              This dApp requires the MetaMask browser extension to interact with the Ethereum blockchain.
            </p>
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="btn btn--primary">
              Install MetaMask
            </a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="app">
      <Navbar account={account} onConnect={connectWallet} shortAddr={shortAddr} />

      <main className="main">
        {/* Hero */}
        <div className="hero">
          <h1 className="hero__title">DigitalItem Marketplace</h1>
          <p className="hero__desc">
            A decentralized marketplace contract deployed on the Sepolia testnet. 
            Connect your wallet to view contract state and purchase the digital item.
          </p>
        </div>

        {/* Network Warning */}
        {account && !isCorrectNetwork && (
          <div className="network-banner">
            <span>⚠️</span>
            <span className="network-banner__text">
              You are connected to the wrong network. Please switch to Sepolia.
            </span>
            <button id="switch-network-btn" className="btn btn--outline btn--sm" onClick={switchToSepolia}>
              Switch Network
            </button>
          </div>
        )}

        {/* Status Toast */}
        {txStatus && (
          <div className={`toast toast--${txStatus.type}`}>
            {txStatus.type === 'pending' && <span className="spinner" />}
            {txStatus.type === 'success' && <span>✓</span>}
            {txStatus.type === 'error' && <span>✕</span>}
            <span>{txStatus.message}</span>
          </div>
        )}

        {/* Not Connected */}
        {!account && (
          <div className="connect-section">
            <p className="connect-section__title">Connect Your Wallet</p>
            <p className="connect-section__text">
              Connect MetaMask to view live contract data and interact with the smart contract.
            </p>
            <button id="connect-wallet-btn" className="btn btn--primary" onClick={connectWallet}>
              🦊&nbsp;&nbsp;Connect MetaMask
            </button>
          </div>
        )}

        {/* Connected + Correct Network */}
        {account && isCorrectNetwork && price !== null && (
          <>
            {/* ── Contract Overview ── */}
            <div className="section-label">Contract Overview</div>
            <div className="info-grid">
              <div className="info-item">
                <div className="info-item__label">Item Price</div>
                <div className="info-item__value">
                  {formatEther(price)}
                  <span className="info-item__unit">ETH</span>
                </div>
              </div>
              <div className="info-item">
                <div className="info-item__label">Total Purchases</div>
                <div className="info-item__value">{purchaseCount}</div>
              </div>
              <div className="info-item">
                <div className="info-item__label">Your Status</div>
                <div className="info-item__value" style={{ fontSize: '1rem' }}>
                  {hasPurchased
                    ? <span className="badge badge--success">✓ Purchased</span>
                    : <span className="badge badge--available">Available</span>
                  }
                </div>
              </div>
            </div>

            {/* ── Contract Details ── */}
            <div className="card" style={{ marginBottom: 24 }}>
              <table className="details-table">
                <tbody>
                  <tr>
                    <td>Contract Address</td>
                    <td><span className="address-full">{CONTRACT_ADDRESS}</span></td>
                  </tr>
                  <tr>
                    <td>Network</td>
                    <td>Sepolia Testnet (Chain ID: 11155111)</td>
                  </tr>
                  <tr>
                    <td>Owner</td>
                    <td><span className="mono">{contractOwner ? shortAddr(contractOwner) : '—'}</span></td>
                  </tr>
                  <tr>
                    <td>Connected Wallet</td>
                    <td><span className="mono">{shortAddr(account)}</span></td>
                  </tr>
                  {contractBalance !== null && (
                    <tr>
                      <td>Contract Balance</td>
                      <td>{formatEther(contractBalance)} ETH</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Buy Section ── */}
            <div className="section-label">Purchase</div>
            <div className="buy-section">
              <div className="buy-section__price">
                {formatEther(price)}
                <span className="buy-section__price-unit"> ETH</span>
              </div>
              <div className="buy-section__label">
                {hasPurchased ? 'You already own this item' : 'Price per item — one purchase per wallet'}
              </div>
              <button
                id="buy-btn"
                className="btn btn--primary btn--block"
                onClick={handleBuy}
                disabled={loading || hasPurchased}
              >
                {loading
                  ? <><span className="spinner spinner--white" /> Processing…</>
                  : hasPurchased
                    ? '✓ Already Purchased'
                    : `Buy for ${formatEther(price)} ETH`
                }
              </button>
            </div>

            {/* ── Owner Panel ── */}
            {isOwner && (
              <>
                <div className="section-label" style={{ marginTop: 32 }}>Owner Administration</div>
                <div className="owner-panel">
                  <div className="owner-panel__header">
                    <span>⚙️</span> Contract Owner Controls
                  </div>
                  <div className="owner-panel__body">
                    <div className="owner-panel__section">
                      <div className="owner-panel__section-title">Update Item Price</div>
                      <div className="input-row">
                        <input
                          id="new-price-input"
                          className="input"
                          type="text"
                          placeholder="Enter new price in ETH (e.g. 0.05)"
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                        />
                        <button
                          id="update-price-btn"
                          className="btn btn--outline btn--sm"
                          onClick={handleUpdatePrice}
                          disabled={loading || !newPrice}
                        >
                          {loading ? <span className="spinner" /> : 'Update Price'}
                        </button>
                      </div>
                    </div>

                    <div className="owner-panel__divider" />

                    <div className="owner-panel__section">
                      <div className="owner-panel__section-title">Withdraw Contract Balance</div>
                      <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: 12 }}>
                        Transfer all collected ETH from the contract to the owner wallet.
                        {contractBalance !== null && (
                          <> Current balance: <strong>{formatEther(contractBalance)} ETH</strong></>
                        )}
                      </p>
                      <button
                        id="withdraw-btn"
                        className="btn btn--success"
                        onClick={handleWithdraw}
                        disabled={loading}
                      >
                        {loading ? <><span className="spinner spinner--white" /> Processing…</> : 'Withdraw Funds'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Navbar({ account, onConnect, shortAddr }) {
  return (
    <nav className="navbar">
      <div className="navbar__brand">
        <div className="navbar__logo">DI</div>
        <span className="navbar__name">DigitalItem</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="navbar__network">
          <span className="navbar__network-dot" />
          Sepolia
        </span>
        {!account ? (
          <button className="navbar__wallet-btn" onClick={onConnect}>
            Connect Wallet
          </button>
        ) : (
          <button className="navbar__wallet-btn navbar__wallet-btn--connected">
            <span className="navbar__wallet-dot" />
            {shortAddr(account)}
          </button>
        )}
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      DigitalItem — Solidity Smart Contract on Sepolia Testnet&nbsp;&nbsp;·&nbsp;&nbsp;
      <a
        href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        View on Etherscan
      </a>
    </footer>
  );
}

export default App;
