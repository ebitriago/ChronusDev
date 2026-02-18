
import axios from 'axios';

async function testConnectivity() {
    console.log('🚀 Testing connectivity between services...\n');

    // 1. Check ChronusDev Backend (Project Management)
    try {
        console.log('Testing ChronusDev Backend (localhost:3001)...');
        const devHealth = await axios.get('http://localhost:3001/health');
        console.log('✅ ChronusDev Health:', devHealth.data);
    } catch (e: any) {
        console.error('❌ ChronusDev Backend Failed:', e.message);
    }

    // 2. Check ChronusCRM Backend (CRM + AssistAI)
    try {
        console.log('\nTesting ChronusCRM Backend (localhost:3002)...');
        const crmHealth = await axios.get('http://localhost:3002/health');
        console.log('✅ ChronusCRM Health:', crmHealth.data);
    } catch (e: any) {
        console.error('❌ ChronusCRM Backend Failed:', e.message);
    }

    // 3. Test Integration (ChronusDev -> CRM)
    // Assuming there is an endpoint or we just check network reachability
    console.log('\nTesting Network Reachability...');
    try {
        // Try to reach CRM from "ChronusDev context" (just local fetch for now)
        await axios.get('http://localhost:3002/health');
        console.log('✅ Network path localhost:3001 -> localhost:3002 appears open (shared network)');
    } catch (e) {
        console.log('❌ Network unreachable');
    }
}

testConnectivity();
