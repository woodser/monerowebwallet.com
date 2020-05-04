/**
 * Sample browser application which uses a JavaScript library to interact
 * with a Monero daemon using RPC and a Monero wallet using RPC and WASM
 * bindings.
 */
require("monero-javascript");

/**
 * Main thread.
 */
runMain();
async function runMain() {
  console.log("RUN MAIN");
  
  // config
  let daemonRpcUri = "http://localhost:38081";
  let daemonRpcUsername = "superuser";
  let daemonRpcPassword = "abctesting123";
  let walletRpcUri = "http://localhost:38083";
  let walletRpcUsername = "rpc_user";
  let walletRpcPassword = "abc123";
  let walletRpcFileName = "test_wallet_1";
  let walletRpcFilePassword = "supersecretpassword123";
  let mnemonic = "goblet went maze cylinder stockpile twofold fewest jaded lurk rally espionage grunt aunt puffin kickoff refer shyness tether building eleven lopped dawn tasked toolbox grunt";
  let seedOffset = "";
  let restoreHeight = 531333;
  let proxyToWorker = true;   // proxy wasm wallet and daemon to worker so main thread is not blocked (recommended)
  let useFS = true;           // optionally save wallets to an in-memory file system, otherwise use empty paths
  let FS = useFS ? require('memfs') : undefined;  // use in-memory file system for demo
  
  // load wasm module on main thread
  console.log("Loading wasm module on main thread...");
  await MoneroUtils.loadKeysModule();
  console.log("done loading module");
  
  // demonstrate c++ utilities which use monero-project via webassembly
  let json = { msg: "This text will be serialized to and from Monero's portable storage format!" };
  let binary = MoneroUtils.jsonToBinary(json);
  assert(binary);
  let json2 = MoneroUtils.binaryToJson(binary);
  assert.deepEqual(json2, json);
  console.log("WASM utils to serialize to/from Monero\'s portable storage format working");
  
  // create a random keys-only wallet
  let walletKeys = await MoneroWalletKeys.createWalletRandom(MoneroNetworkType.STAGENET, "English");
  console.log("Keys-only wallet random mnemonic: " + await walletKeys.getMnemonic());
  
  // connect to monero-daemon-rpc on same thread as wasm wallet so requests from same client to daemon are synced
  console.log("Connecting to monero-daemon-rpc" + (proxyToWorker ? " in worker" : ""));
  let daemon = new MoneroDaemonRpc({uri: daemonRpcUri, username: daemonRpcUsername, password: daemonRpcPassword, proxyToWorker: proxyToWorker});
  console.log("Daemon height: " + await daemon.getHeight());
  
  // connect to monero-wallet-rpc
  let walletRpc = new MoneroWalletRpc({uri: walletRpcUri, username: walletRpcUsername, password: walletRpcPassword});
  
  // open or create rpc wallet
  try {
    console.log("Attempting to open wallet " + walletRpcFileName + "...");
    await walletRpc.openWallet(walletRpcFileName, walletRpcFilePassword);
  } catch (e) {
        
    // -1 returned when the wallet does not exist or it's open by another application
    if (e.getCode() === -1) {
      console.log("Wallet with name '" + walletRpcFileName + "' not found, restoring from mnemonic");
      
      // create wallet
      await walletRpc.createWalletFromMnemonic(walletRpcFileName, walletRpcFilePassword, mnemonic, restoreHeight);
      await walletRpc.sync();
    } else {
      throw e;
    }
  }
  
  // print wallet rpc balance
  console.log("Wallet rpc mnemonic: " + await walletRpc.getMnemonic());
  console.log("Wallet rpc balance: " + await walletRpc.getBalance());  // TODO: why does this print digits and not object?
  
  // create a wasm wallet from mnemonic
  let daemonConnection = new MoneroRpcConnection({uri: daemonRpcUri, username: daemonRpcUsername, password: daemonRpcPassword});
  let walletWasmPath = useFS ? GenUtils.getUUID() : "";
  console.log("Creating WebAssembly wallet" + (proxyToWorker ? " in worker" : "") + (useFS ? " at path " + walletWasmPath : ""));
  let walletWasm = await MoneroWalletWasm.createWalletFromMnemonic(walletWasmPath, "abctesting123", MoneroNetworkType.STAGENET, mnemonic, daemonConnection, restoreHeight, seedOffset, proxyToWorker, FS); 
  console.log("WebAssembly wallet imported mnemonic: " + await walletWasm.getMnemonic());
  console.log("WebAssembly wallet imported address: " + await walletWasm.getPrimaryAddress());
  
  // synchronize wasm wallet
  console.log("Synchronizing wasm wallet...");
  let result = await walletWasm.sync(new WalletSyncPrinter());  // synchronize and print progress
  console.log("Done synchronizing");
  console.log(result);
  
  // start background syncing with listener
  await walletWasm.addListener(new WalletSendReceivePrinter()); // listen for and print send/receive notifications
  await walletWasm.startSyncing();                              // synchronize in background
  
  // print balance and number of transactions
  console.log("WebAssembly wallet balance: " + await walletWasm.getBalance());
  console.log("WebAssembly wallet number of txs: " + (await walletWasm.getTxs()).length);
  
  // send transaction to self, listener will notify when output is received
  console.log("Sending transaction to self");
  let txSet = await walletWasm.sendTx(0, await walletWasm.getPrimaryAddress(), new BigInteger("75000000000"));
  console.log("Transaction sent successfully.  Should receive notification soon...");
  console.log("Transaction hash: " + txSet.getTxs()[0].getHash());
  
  console.log("EXIT MAIN");
}

/**
 * Print sync progress every X blocks.
 */
class WalletSyncPrinter extends MoneroWalletListener {
  
  constructor(blockResolution) {
    super();
    this.blockResolution = blockResolution ? blockResolution : 2500;
  }
  
  onSyncProgress(height, startHeight, endHeight, percentDone, message) {
    if (percentDone === 1 || (startHeight - height) % this.blockResolution === 0) {
      console.log("onSyncProgress(" + height + ", " + startHeight + ", " + endHeight + ", " + percentDone + ", " + message + ")");
    }
  }
}

/**
 * Print sync progress every X blocks.
 */
class WalletSendReceivePrinter extends MoneroWalletListener {
  
  constructor(blockResolution) {
    super();
  }

  onOutputReceived(output) {
    console.log("Wallet received output!");
    console.log(output.toJson());
  }
  
  onOutputSpent(output) {
    console.log("Wallet spent output!");
    console.log(output.toJson());
  }
}