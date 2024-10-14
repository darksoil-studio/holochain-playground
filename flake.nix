{
  description = "Template for Holochain app development";

  inputs = {
    nixpkgs.follows = "holonix/nixpkgs";
    holonix.url = "github:holochain/holonix/main-0.3";

    p2p-shipyard.url = "github:darksoil-studio/p2p-shipyard";
    hc-infra.url = "github:holochain-open-dev/infrastructure";
  };

  outputs = inputs@{ ... }:
    inputs.holonix.inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = builtins.attrNames inputs.holonix.devShells;
      perSystem = { config, pkgs, system, inputs', lib, ... }: rec {
        devShells.default = pkgs.mkShell {
          inputsFrom = [
            inputs.holonix.devShells.${system}.default
            inputs'.hc-infra.devShells.synchronized-pnpm
          ];
          packages = [
            pkgs.nodejs_20
            inputs'.p2p-shipyard.packages.hc-pilot
            pkgs.mprocs
          ];
        };

        packages.hc-playground = let
          cliDist = pkgs.stdenv.mkDerivation (finalAttrs: {
            version = "0.300.0";
            pname = "holochain-playground-cli";
            src =
              # (inputs.hc-infra.outputs.lib.cleanPnpmDepsSource { inherit lib; })
              ./.;

            nativeBuildInputs =
              with inputs.hc-infra.inputs.pnpmnixpkgs.outputs.legacyPackages.${system}; [
                nodejs
                pnpm.configHook
              ];
            pnpmDeps =
              inputs.hc-infra.inputs.pnpmnixpkgs.outputs.legacyPackages.${system}.pnpm.fetchDeps {
                inherit (finalAttrs) version pname src;

                hash = "sha256-KWJc+daidI1vkdBDCSGkzC9C/dkE3PPgbIB3Mpxtc1A=";
              };
            buildPhase = ''
              runHook preBuild

              pnpm build:cli

              runHook postBuild
              mkdir $out
              cp -R packages/cli/server/dist $out
            '';
          });
        in pkgs.writeShellScriptBin "hc-playground" ''
          ${pkgs.nodejs_20}/bin/node ${cliDist}/dist/app.js "$@"
        '';
        apps.default.program = pkgs.writeShellApplication {
          name = "hc-playground";
          runtimeInputs = [ packages.hc-playground ];
          text = ''
            hc-playground "$@"
          '';
          meta.mainProgram = "hc-playground";
        };
      };
    };
}
