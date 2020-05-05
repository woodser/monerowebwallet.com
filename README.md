## Description

Placeholder for an open-source, client-side web wallet which performs transaction scanning client-side and without sharing the view key with an external server using the [monero-javascript](https://github.com/monero-ecosystem/monero-javascript) library.

## How to Run in a Browser
1. Download and install [Monero CLI](https://getmonero.org/downloads/)
2. Start monero-daemon-rpc with authentication and CORS access.  For example: `./monerod --stagenet --rpc-login superuser:abctesting123 --rpc-access-control-origins http://localhost:9100`
3. Start monero-wallet-rpc with authentication and CORS access.  For example: `./monero-wallet-rpc --daemon-address http://localhost:38081 --daemon-login superuser:abctesting123 --stagenet --rpc-bind-port 38083 --rpc-login rpc_user:abc123 --rpc-access-control-origins http://localhost:9100 --wallet-dir ./`
4. `git clone https://github.com/woodser/monerowebwallet.com`
5. `cd monerowebwallet.com`
6. `npm install`
7. `./bin/build_browser_app.sh`
8. Access web app at http://localhost:9100

## Starting Designs (contributions welcome)

<p align="center">
	<img width="25%" src="src/mockups/wallet/web_wallet.001.jpeg"/><br><br>
	<img width="25%" src="src/mockups/wallet/web_wallet.002.jpeg"/><br><br>
	<img width="25%" src="src/mockups/wallet/web_wallet.006.jpeg"/><br><br>
	<img width="25%" src="src/mockups/wallet/web_wallet.008.jpeg"/><br><br>
	<img width="25%" src="src/mockups/wallet/web_wallet.009.jpeg"/><br><br>
	<img width="25%" src="src/mockups/wallet/web_wallet.010.jpeg"/><br><br>
	<img width="25%" src="src/mockups/wallet/web_wallet.011.jpeg"/><br><br>
</p>