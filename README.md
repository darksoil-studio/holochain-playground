# Holochain Playground

The playground is a CLI to introspect running holochain nodes.

## Running the playground directly

```bash
nix run github:darksoil-studio/holochain-playground/main-0.4 ws://localhost:8888 ws://localhost:8889
```

This URL should point to the admin interfaces of the conductors.

## Importing in a flake

Add it to your `flake.nix` with:

```diff
{
  inputs = {
    holonix.url = "github:holochain/holonix/main-0.4";
    nixpkgs.follows = "holonix/nixpkgs";

+    holochain-playground.url = "github:darksoil-studio/holochain-playground/main-0.4";
  };

  nixConfig = {
    extra-substituters = [
      "https://holochain-ci.cachix.org"
+      "https://darksoil-studio.cachix.org"
    ];
    extra-trusted-public-keys = [
      "holochain-ci.cachix.org-1:5IUSkZc0aoRS53rfkvH9Kid40NpyjwCMCzwRTXy+QN8="
+      "darksoil-studio.cachix.org-1:UEi+aujy44s41XL/pscLw37KEVpTEIn8N/kn7jO8rkc="
    ];
  };

  outputs = inputs@{ ... }:
    inputs.holonix.inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = builtins.attrNames inputs.holonix.devShells;
      perSystem = { config, pkgs, system, inputs', lib, ... }: rec {
        devShells.default = pkgs.mkShell {
          inputsFrom = [
            inputs.holonix.devShells.${system}.default
          ];
          packages = [
+            inputs'.holochain-playground.packages.hc-playground
          ];
        };
      };
    };
}
```

Then, you should have an `hc-playground` binary in your nix shell.

To have the playground running for development conductors, just run `hc-playground` in the same folder where you have run `hc sandbox`, `hc spin` or `hc launch`.
