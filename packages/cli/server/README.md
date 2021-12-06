# @holochain-playground/cli

Small CLI utility to run the [Holochain Playground](https://holochain-playground.github.io/) connected to a real Holochain conductor.

This is useful as an introspection tool, to understand what's really going on in your Holochain node.

## Running directly pointing to a running conductor

```bash
npx @holochain-playground/cli ws://localhost:8888 ws://localhost:8889
```

This URL should point to the Admin interfaces of the conductors.

## Setting up in an NPM hApp development environment that uses `hc sandbox`

If you run this CLI from the same folder from which you run your hc sandboxes, it will automatically connect with the conductors that are live.

1. Install the CLI with:

```bash
npm install -D @holochain-playground/cli
```

2. Add a `playground` script in your `package.json`:

```json
{
    ...
    "scripts": {
        "start": "concurrently \"npm run start:hc\" \"npm run playground\"",
        "start:hc": "hc s generate --run=8888",
        "playground": "holochain-playground"
    }
}
```

Now, when you run `npm start`, it will bring up the playground connected to the conductor.