/**
 * Sample browser application which uses a JavaScript library to interact
 * with a Monero daemon using RPC and a Monero wallet using RPC and WASM
 * bindings.
 */
const assert = require("assert");
const monerojs = require("monero-javascript");
const MoneroUtils = monerojs.MoneroUtils;
const MoneroWalletListener = monerojs.MoneroWalletListener;
const MoneroRpcConnection = monerojs.MoneroRpcConnection;
const GenUtils = monerojs.GenUtils;
const LibraryUtils = monerojs.LibraryUtils;

/**
 * Main thread.
 */
runMain();
async function runMain() {

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
  let useFS = true;           // optionally save wallets to an in-memory file system, otherwise use empty paths
  
  // load wasm module on main thread
  console.log("Loading wasm module on main thread...");
  await LibraryUtils.loadKeysModule();
  console.log("done loading module");
  
  // demonstrate c++ utilities which use monero-project via webassembly
  let json = { msg: "This text will be serialized to and from Monero's portable storage format!" };
  let binary = MoneroUtils.jsonToBinary(json);
  assert(binary);
  let json2 = MoneroUtils.binaryToJson(binary);
  assert.deepEqual(json2, json);
  console.log("WASM utils to serialize to/from Monero\'s portable storage format working");
  
  // create a random keys-only wallet
  let walletKeys = await monerojs.createWalletKeys({
    networkType: MoneroNetworkType.STAGENET,
    language: "English"
  });
  console.log("Keys-only wallet random mnemonic: " + await walletKeys.getMnemonic());
  
  // connect to monero-daemon-rpc on same thread as wasm wallet so requests from same client to daemon are synced
  console.log("Connecting to monero-daemon-rpc");
  let daemon = monerojs.connectToDaemonRpc(daemonRpcUri, daemonRpcUsername, daemonRpcPassword);
  console.log("Daemon height: " + await daemon.getHeight());
  
  // connect to monero-wallet-rpc
  let walletRpc = monerojs.connectToWalletRpc(walletRpcUri, walletRpcUsername, walletRpcPassword);
  
  // open or create rpc wallet
  try {
    console.log("Attempting to open wallet " + walletRpcFileName + "...");
    await walletRpc.openWallet(walletRpcFileName, walletRpcFilePassword);
  } catch (e) {
        
    // -1 returned when the wallet does not exist or it's open by another application
    if (e.getCode() === -1) {
      console.log("Wallet with name '" + walletRpcFileName + "' not found, restoring from mnemonic");
      
      // create wallet
      await walletRpc.createWallet({
        path: walletRpcFileName,
        password: walletRpcFilePassword,
        mnemonic: mnemonic,
        restoreHeight: restoreHeight
      });
      await walletRpc.sync();
    } else {
      throw e;
    }
  }
  
  // print wallet rpc balance
  console.log("Wallet rpc mnemonic: " + await walletRpc.getMnemonic());
  console.log("Wallet rpc balance: " + await walletRpc.getBalance());  // TODO: why does this print digits and not object?
  
  // create a wasm wallet from mnemonic
  let daemonConnection = new MoneroRpcConnection(daemonRpcUri, daemonRpcUsername, daemonRpcPassword);
  let walletWasmPath = useFS ? GenUtils.getUUID() : "";
  console.log("Creating WebAssembly wallet" + (useFS ? " at path " + walletWasmPath : ""));
  let walletWasm = await monerojs.createWalletWasm({
    path: walletWasmPath,
    password: "abctesting123",
    networkType: MoneroNetworkType.STAGENET,
    mnemonic: mnemonic,
    server: daemonConnection,
    restoreHeight: restoreHeight,
    seedOffset: seedOffset
  }); 
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
  let tx = await walletWasm.createTx({
    accountIndex: 0, 
    address: await walletWasm.getAddress(1, 0),
    amount: new BigInteger("75000000000"),
    relay: true
  });
  console.log("Transaction " + tx.getHash() + " sent successfully.  Should receive notification soon...");
}

/**
 * Print sync progress every X blocks.
 */
class WalletSyncPrinter extends MoneroWalletListener {
  
  constructor(syncResolution) {
    super();
    this.nextIncrement = 0;
    this.syncResolution = syncResolution ? syncResolution : .05;
  }
  
  onSyncProgress(height, startHeight, endHeight, percentDone, message) {
    if (percentDone === 1 || percentDone >= this.nextIncrement) {
      console.log("onSyncProgress(" + height + ", " + startHeight + ", " + endHeight + ", " + percentDone + ", " + message + ")");
      this.nextIncrement += this.syncResolution;
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