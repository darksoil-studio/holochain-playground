{
  description = "Template for Holochain app development";

  inputs = {
    nixpkgs.follows = "holonix/nixpkgs";
    holonix.url = "github:holochain/holonix/main-0.3";

    p2p-shipyard.url = "github:darksoil-studio/p2p-shipyard/develop";
  };

  outputs = inputs@{ ... }:
    inputs.holonix.inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = builtins.attrNames inputs.holonix.devShells;
      perSystem = { config, pkgs, system, inputs', ... }: {
        devShells.default = pkgs.mkShell {
          inputsFrom = [ inputs.holonix.devShells.${system}.default ];
          packages = [
            pkgs.nodejs_20
            inputs'.p2p-shipyard.packages.hc-pilot
            pkgs.mprocs
          ];
        };
      };
    };
}
