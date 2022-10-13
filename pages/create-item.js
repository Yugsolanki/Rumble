import { useState } from "react";
import {ethers} from 'ethers'
import {create} from 'ipfs-http-client'
import {useRouter} from 'next/router'
import Web3Modal from 'web3modal'

const projectId = '2G3ApxYPVKun15BgwZIr7bHIm57';
const projectSecret = '1439fc4be36c27310cdfb5867f97ad06';
const auth =
    'Basic ' + Buffer.from(projectId + ':' + projectSecret, 'utf-8').toString('base64');
const client = create({
    host: 'infura-ipfs.io',
    port: 5001,
    protocol: 'https',
    apiPath: '/api/v0',
    headers: {
        authorization: auth,
    },
    //timeout: '2m'
});

// const ipfsClient = require(‘ipfs-http-client’);
// const projectId = ’XXX...XXX;
// const projectSecret = ‘XXX...XXX’;
// const auth = ‘Basic ’ + Buffer.from(projectId + ‘:’ + projectSecret).toString(‘base64’);
// const client = ipfsClient.create({
//     host: ‘ipfs.infura.io’,
//     port: 5001,
//     protocol: ‘https’,
//     headers: {
//         authorization: auth,
//     },
// });

import {
    nftaddress, nftmarketaddress
} from '../config'
  
import NFT from '../artifacts/contracts/NFT.sol/NFT.json'
import Market from '../artifacts/contracts/NFTMarket.sol/NFTMarket.json'

export default function CreateItem() {
    const [fileUrl, setFileUrl] = useState(null)
    const [formInput, updateFormInput] = useState({price: '', name: '', description: ''})
    const router = useRouter()

    async function onChange(e) {
        const file = e.target.files[0]
        try {
            const added = await client.add(
                file,
                {
                    progress: (prog) => console.log(`received: ${prog}`)
                }
            )
            const url = `https://infura-ipfs.io/ipfs/${added.path}` 
            setFileUrl(url)
        } catch (e) {
            console.log(e)
        }
    }

    async function createItem() {
        const {name, description, price} = formInput
        if (!name || !description || !price || !fileUrl) return
        const data = JSON.stringify({
            name, description, image: fileUrl
        })

        try {
            const added = await client.add(data)
            const url = `https://infura-ipfs.io/ipfs/${added.path}`
            createSale(url)
        } catch (error) {
            console.log('Error uploading file: ', error);
        }
    }

    async function createSale(url) {
        const web3modal = new Web3Modal()
        const connection = await web3modal.connect()
        const provider = new ethers.providers.Web3Provider(connection)
        const signer = provider.getSigner()

        let contract = new ethers.Contract(nftaddress, NFT.abi, signer)
        let transaction = await contract.createToken(url)
        let tx = await transaction.wait()

        let event = tx.events[0]
        let value = event.args[2]
        let tokenId = value.toNumber()

        const price =  ethers.utils.parseUnits(formInput.price, 'ether')

        contract = new ethers.Contract(nftmarketaddress, Market.abi, signer)
        let listingPrice = await contract.getListingPrice()
        listingPrice = listingPrice.toString()

        transaction = await contract.createMarketItem(
            nftaddress, tokenId, price, {value: listingPrice}
        )
        await transaction.wait()
        router.push('/')
    }

    return (
        <div className="flex justify-center">
            <div className="w-1/2 flex flex-col pb-12">
                <input 
                    placeholder="Asset Name"
                    className="mt-8 border rounded p-4"
                    onChange={e => updateFormInput({...formInput, name: e.target.value})}
                />
                <textarea 
                    placeholder="Asset Description"
                    className="mt-2 border rounded p-4"
                    onChange={e => updateFormInput({...formInput, description: e.target.value})}
                />
                <input 
                    placeholder="Asset Price in Matic"
                    className="mt-2 border rounded p-4"
                    onChange={e => updateFormInput({...formInput, price: e.target.value})}
                />
                <input 
                    type="file"
                    name="Asset"
                    className="my-4"
                    onChange={onChange}
                />
                {
                    fileUrl && (
                        <img className="rounded mt-4" width="350" src={fileUrl}/>
                    )
                }
                <button onClick={createItem} className="font-bold mt-4 bg-pink-500 text-white rounded p-4 shadow-lg">
                    Create Digital Asset
                </button>
            </div>
        </div>
    )
}
