import { MilvusClient } from '@zilliz/milvus2-sdk-node';

async function main() {
    const client = new MilvusClient({ address: 'localhost:19530' });
    
    // Check collection first
    const hasCollection = await client.hasCollection({ collection_name: 'geo_vectors' });
    console.log('geo_vectors exists:', hasCollection.value);
    
    if (hasCollection.value) {
        // Force flush
        console.log('Flushing...');
        await client.flush({ collection_names: ['geo_vectors'] });
        
        const stats = await client.getCollectionStatistics({ collection_name: 'geo_vectors' });
        console.log('Collection stats:', stats);
        
        console.log('Loading collection...');
        await client.loadCollection({ collection_name: 'geo_vectors' });
        
        // Search
        const queryInfo = await client.query({
            collection_name: 'geo_vectors',
            expr: 'knowledge_id >= 0',
            output_fields: ['knowledge_id', 'creative_id', 'campaign_id'],
            limit: 10,
        });
        console.log('Query all (limit 10):', queryInfo);
    }
}

main().catch(console.error);
