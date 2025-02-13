import { Config, names, uniqueNamesGenerator } from 'unique-names-generator';

import { BootstrapService } from '../bootstrap/bootstrap-service.js';
import { Conductor } from '../core/conductor.js';
import { SimulatedHappBundle } from '../dnas/simulated-dna.js';

const config: Config = {
	dictionaries: [names],
};

export async function createConductors(
	conductorsToCreate: number,
	currentConductors: Conductor[],
	happ: SimulatedHappBundle,
): Promise<Conductor[]> {
	const newConductors = await createConductorsWithoutHapp(
		conductorsToCreate,
		currentConductors,
	);

	await Promise.all(newConductors.map(async c => c.installApp(happ, {})));

	return newConductors;
}

export async function createConductorsWithoutHapp(
	conductorsToCreate: number,
	currentConductors: Conductor[],
): Promise<Conductor[]> {
	const bootstrapService =
		currentConductors.length === 0
			? new BootstrapService()
			: currentConductors[0].network.bootstrapService;

	const newConductorsPromises: Promise<Conductor>[] = [];
	for (let i = 0; i < conductorsToCreate; i++) {
		const characterName: string = uniqueNamesGenerator(config);
		const conductor = Conductor.create(bootstrapService, characterName);
		newConductorsPromises.push(conductor);
	}

	const newConductors = await Promise.all(newConductorsPromises);

	return newConductors;
}
