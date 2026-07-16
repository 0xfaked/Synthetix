import { createPublicClient, http } from 'viem'
import { flareTestnet } from 'viem/chains'

const client = createPublicClient({
  chain: flareTestnet,
  transport: http('https://coston2-api.flare.network/ext/C/rpc')
})

async function main() {
  const hash = '0xedb93a82ce363108374bd7de1c450e76c2316ed494c9a03268c04c2e68f43fca'
  try {
    const receipt = await client.getTransactionReceipt({ hash })
    console.log("Transaction Status:", receipt.status)
    if (receipt.status === 'reverted') {
      const tx = await client.getTransaction({ hash })
      try {
        await client.call({
          to: tx.to,
          data: tx.input,
          value: tx.value,
          account: tx.from,
        })
      } catch (err) {
        console.log("Revert Reason:", err.shortMessage || err.message)
      }
    }
  } catch (err) {
    console.error("Error:", err.message)
  }
}
main()
