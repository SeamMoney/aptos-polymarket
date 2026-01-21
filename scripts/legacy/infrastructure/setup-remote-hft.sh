#!/bin/bash
# Setup HFT worker on a remote DigitalOcean VM
# Usage: ./scripts/setup-remote-hft.sh <server-ip>

SERVER_IP=${1:-"209.38.172.28"}

echo "=============================================="
echo "  Setting up HFT Worker on $SERVER_IP"
echo "=============================================="

# Create the HFT package directory
ssh root@$SERVER_IP "mkdir -p /opt/aptos-hft"

# Copy the server file
echo "Copying server files..."
scp server/hft-ultra-server.ts root@$SERVER_IP:/opt/aptos-hft/
scp package.json root@$SERVER_IP:/opt/aptos-hft/
scp tsconfig.json root@$SERVER_IP:/opt/aptos-hft/

# Create the run script with all env vars
cat << 'RUNSCRIPT' | ssh root@$SERVER_IP "cat > /opt/aptos-hft/run-hft.sh"
#!/bin/bash
cd /opt/aptos-hft

export APTOS_API_KEY=AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH
export QUICKNODE_RPC="https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1"
export CONTRACT_ADDRESS=0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1
export MULTI_MARKET=0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96
export HFT_PORT=3001

# Split keys - this worker gets accounts 11-20
export ULTRA_PRIVATE_KEYS="ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761,ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465,ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749,ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637,ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC,ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315,ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F,ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A,ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097,ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C"

echo "Starting HFT worker..."
npx tsx hft-ultra-server.ts "${1:-normal}" "${2:-60}"
RUNSCRIPT

# Install Node.js if needed and run
ssh root@$SERVER_IP << 'INSTALLCMD'
cd /opt/aptos-hft
chmod +x run-hft.sh

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install dependencies
npm install --silent 2>/dev/null
npm install -g tsx 2>/dev/null

echo ""
echo "✓ HFT Worker setup complete!"
echo ""
echo "To run: ssh root@$SERVER_IP '/opt/aptos-hft/run-hft.sh normal 60'"
INSTALLCMD

echo ""
echo "=============================================="
echo "  Setup Complete!"
echo "=============================================="
echo ""
echo "Run the worker with:"
echo "  ssh root@$SERVER_IP '/opt/aptos-hft/run-hft.sh normal 60'"
