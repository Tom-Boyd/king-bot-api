import api from './api';
import settings from './settings';
import { log, sleep } from './util';
import { Ivillage, Ifarmlist, Iunits } from './interfaces';
import building_queue, { Iresource_type } from './building';
import farming from './farming';
import village from './village';
import { tribe } from './data';

class kingbot {
	async login(gameworld: string, email: string = '', password: string = ''): Promise<void> {
		if(!email || !password || !gameworld) {
			let cred: any = settings.read_credentials();

			if(cred) {
				email = cred.email;
				password = cred.password;
				gameworld = cred.gameworld;
			}
		}
		
		if(!email || !password || !gameworld) {
			log('please provide email, password and gameworld');
			process.exit();
			return;
		}
		
		console.log(`start login to gameworld ${gameworld} with account ${email} ...`);
		await api.login(email, password, gameworld);
		settings.gameworld = gameworld.toLowerCase();
	}

	async start_farming(farmlists: string[], village_name: string | string[], interval: number): Promise<void> {
		if(Array.isArray(village_name)) {
			for(let name of village_name) this.start_farming(farmlists, name, interval);
			return;
		}

		const params = [
			village.own_villages_ident,
			farming.farmlist_ident
		];

		// fetch farmlists
		const response = await api.get_cache(params);

		const vill: Ivillage | null = village.find(village_name, response);
		if(!vill) return;

		const village_id: number = vill.villageId;
		const farmlist_ids: number[] = [];

		for(let list of farmlists) {
			const list_obj = farming.find(list, response);
			if(!list_obj) return;

			const list_id: number = list_obj.listId;
			farmlist_ids.push(list_id);
		}

		if(!farmlist_ids) return;

		while(true) {
			await api.send_farmlists(farmlist_ids, village_id);
			log(`farmlists ${farmlists} sent from village ${village_name}`);

			await sleep(interval);
		}
	}

	add_building_queue(resources: Iresource_type, village_name: string): void {
		building_queue.upgrade_res(resources, village_name);
	}

	finish_earlier(): void {
		building_queue.upgrade_earlier();
	}

	async scout(farmlist_name: string, village_name: string, amount: number = 1) {
		const params = [
			village.own_villages_ident,
			farming.farmlist_ident,
			'Player:'
		];

		// fetch data
		const response = await api.get_cache(params);

		const vill: Ivillage | null = village.find(village_name, response);
		if(!vill) return;

		const village_id: number = vill.villageId;

		const list_obj = farming.find(farmlist_name, response);
		if(!list_obj) return;

		const list_id: number = list_obj.listId;

		if(!list_id) return;

		// get own tribe
		const player_data: any = response.find((x: any) => {
			if(x.name.includes('Player:')) {
				if(x.name != 'Player:0') return true;
			}

			return false;
		});
		const own_tribe: tribe = player_data.data.tribeId;

		const units: Iunits = {
			1: 0,
			2: 0,
			3: 0,
			4: 0,
			5: 0,
			6: 0,
			7: 0,
			8: 0,
			9: 0,
			10: 0,
			11: 0
		};

		// scouts are on different positions
		if(own_tribe == tribe.gaul) units[3] = amount;
		else units[4] = amount;

		// send scouts
		for(let target of list_obj.villageIds) {
			await api.send_units(village_id, target, units, 6);
		}

	}

	async inactive_test() {
		farming.find_inactive();
	}
}

export default new kingbot();
