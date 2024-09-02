import { notifyError } from '@holochain-open-dev/elements';
import {
	Dictionary,
	SimulatedHappBundle,
} from '@holochain-playground/simulator';
import { html } from 'lit';

import { PlaygroundElement } from '../../base/playground-element.js';
import { SimulatedConductorStore } from '../../store/simulated-playground-store.js';
import { CallableFn } from '../helpers/call-functions.js';

export function adminApi(
	element: PlaygroundElement,
	allHapps: Dictionary<SimulatedHappBundle>,
	conductorStore: SimulatedConductorStore,
): CallableFn[] {
	const installedAppIds = Object.keys(conductorStore.conductor.installedHapps);

	const nonInstalledHapps = Object.keys(allHapps).filter(
		key => !installedAppIds.includes(key),
	);

	return [
		{
			name: 'Install hApp',
			args: [
				{
					name: 'hAppId',
					field: 'custom',
					required: true,
					render(args, setValue) {
						if (nonInstalledHapps.length === 0)
							return html`<span class="placeholder"
								>There are no hApps that you don't have installed</span
							>`;

						return html`<mwc-select
							outlined
							required
							label="Select Happ to Install"
							.value=${args['hAppId']}
							@selected=${(e: any) =>
								setValue(nonInstalledHapps[e.detail.index])}
						>
							${nonInstalledHapps.map(
								appId =>
									html`<mwc-list-item .value=${appId}>${appId}</mwc-list-item>`,
							)}
						</mwc-select>`;
					},
				},

				{
					name: 'membraneProofs',
					field: 'custom',
					required: false,
					render(args, setValue) {
						if (!args['hAppId'])
							return html`<div class="column">
								<span>Membrane Proofs</span
								><span style="margin-top: 4px;" class="placeholder"
									>Select a hApp to install</span
								>
							</div>`;

						const membraneProofs = args['membraneProofs'] || {};
						const happ: SimulatedHappBundle = allHapps[args['hAppId']];

						return html` <div class="column">
							<span>Membrane Proofs</span>${Object.entries(happ.roles)
								.filter(([_, dna]) => !dna.deferred)
								.map(
									([cellRole, dna]) =>
										html`<mwc-textfield
											style="margin-top: 12px;"
											outlined
											.label=${cellRole}
											.value=${(args['membraneProofs'] &&
												args['membraneProofs'][cellRole]) ||
											''}
											@input=${(e: any) =>
												setValue({
													...membraneProofs,
													[cellRole]: e.target.value,
												})}
										>
										</mwc-textfield>`,
								)}
						</div>`;
					},
				},
			],
			call: async args => {
				const happ = args['hAppId'];

				await conductorStore.conductor.installHapp(
					happ,
					args['membraneProofs'] || {},
				);
			},
		},
		{
			name: 'Clone DNA',
			args: [
				{
					name: 'installedAppId',
					field: 'custom',
					required: true,
					render(args, setValue) {
						return html`<mwc-select
							outlined
							label="Select Happ"
							.value=${args['installedAppId']}
							@selected=${(e: any) => setValue(installedAppIds[e.detail.index])}
						>
							${installedAppIds.map(
								installedAppId =>
									html`<mwc-list-item .value=${installedAppId}
										>${installedAppId}</mwc-list-item
									>`,
							)}
						</mwc-select>`;
					},
				},
				{
					name: 'cellRole',
					field: 'custom',
					required: true,
					render(args, setValue) {
						const cellRoles = args.installedAppId
							? Object.keys(
									conductorStore.conductor.installedHapps[args.installedAppId]
										.roles,
								)
							: [];
						return html`<mwc-select
							outlined
							label="Select DNA Role"
							.value=${args['cellRole']}
							@selected=${(e: any) => setValue(cellRoles[e.detail.index])}
						>
							${cellRoles.map(
								nick =>
									html`<mwc-list-item .value=${nick}>${nick}</mwc-list-item>`,
							)}
						</mwc-select>`;
					},
				},
				{ name: 'uid', field: 'textfield', type: 'String' },
				{
					name: 'properties',
					field: 'custom',
					render(args, setValue) {
						const properties = args['properties'] || {};

						const propertyNames = args['cellRole']
							? Object.keys(
									conductorStore.conductor.registeredDnas.get(
										conductorStore.conductor.installedHapps[args.installedAppId]
											.roles[args.cellRole].base_cell_id[0],
									).properties,
								)
							: [];
						return html`<div class="column">
							<span>Properties</span>
							${args['cellRole']
								? propertyNames.length === 0
									? html`<span style="margin-top: 4px;" class="placeholder"
											>This Dna has no properties</span
										>`
									: html`
											${propertyNames.map(
												property =>
													html`<mwc-textfield
														style="margin-top: 8px"
														outlined
														label=${property}
														.value=${properties[property] || ''}
														@input=${(e: any) =>
															setValue({
																...properties,
																[property]: e.target.value,
															})}
													></mwc-textfield>`,
											)}
										`
								: html`<span style="margin-top: 4px;" class="placeholder"
										>Select a Dna role</span
									>`}
						</div>`;
					},
				},
				{ name: 'membraneProof', field: 'textfield', type: 'String' },
			],
			call: async args => {
				try {
					const cell = await conductorStore.conductor.cloneCell(
						args.installedAppId,
						args.cellRole,
						args.uid,
						args.properties,
						args.membraneProof,
					);

					element.store.activeDna.set(cell.dnaHash);
					element.store.activeAgentPubKey.set(cell.agentPubKey);
				} catch (e) {
					notifyError(`Error: ${(e as any).message}`);
				}
			},
		},
	];
}
