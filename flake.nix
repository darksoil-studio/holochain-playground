{
  description = "Template for Holochain app development";

  inputs = {
    nixpkgs.follows = "holochain/nixpkgs";

    holochain = {
      url = "github:holochain/holochain";
      inputs.versions.url = "github:holochain/holochain?dir=versions/weekly";
    };
  };

  outputs = inputs@{ ... }:
    inputs.holochain.inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = builtins.attrNames inputs.holochain.devShells;
      perSystem = { config, pkgs, system, ... }: {
        devShells.default = pkgs.mkShell {
          inputsFrom = [ inputs.holochain.devShells.${system}.holonix ];
          packages = [ pkgs.nodejs_20 ];
        };
      };
    };
}
