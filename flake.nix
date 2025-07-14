{
  description = "Template for Holochain app development";

  inputs = {
    holonix.url = "github:holochain/holonix/main-0.5";

    # TODO: Remove when https://github.com/holochain/holochain/issues/5130 is resolved
    holonix.inputs.holochain.follows = "holochain";
    holochain.url = "github:holochain/holochain/holochain-0.5.4";
    holochain.inputs.repo-git.follows = "empty";
    empty.url = "github:steveej/empty";
    empty.flake = false;

    nixpkgs.follows = "holonix/nixpkgs";

    tauri-plugin-holochain.url =
      "github:darksoil-studio/tauri-plugin-holochain/main-0.5";
    scaffolding.url = "github:darksoil-studio/scaffolding/main-0.5";
  };

  nixConfig = {
    extra-substituters = [
      "https://holochain-ci.cachix.org"
      "https://darksoil-studio.cachix.org"
    ];
    extra-trusted-public-keys = [
      "holochain-ci.cachix.org-1:5IUSkZc0aoRS53rfkvH9Kid40NpyjwCMCzwRTXy+QN8="
      "darksoil-studio.cachix.org-1:UEi+aujy44s41XL/pscLw37KEVpTEIn8N/kn7jO8rkc="
    ];
  };

  outputs = inputs@{ ... }:
    inputs.holonix.inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = builtins.attrNames inputs.holonix.devShells;
      perSystem = { config, pkgs, system, inputs', lib, ... }: rec {
        devShells.default = pkgs.mkShell {
          inputsFrom = [ inputs.holonix.devShells.${system}.default ];
          packages = [
            pkgs.pnpm
            pkgs.nodejs_22
            inputs'.tauri-plugin-holochain.packages.hc-pilot
          ];
        };

        packages.hc-playground = let
          cliDist = pkgs.stdenv.mkDerivation (finalAttrs: {
            version = "0.500.0";
            pname = "hc-playground";
            src = (inputs.scaffolding.outputs.lib.cleanPnpmDepsSource {
              inherit lib;
            }) ./.;

            nativeBuildInputs = [ pkgs.nodejs pkgs.pnpm.configHook ];
            pnpmDeps = pkgs.pnpm.fetchDeps {
              inherit (finalAttrs) version pname src;

              hash = "sha256-T0SufVzwiCumHXJzzbR4PSsUO8OkFQ2EjBp1qzxR/oI=";
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
          ${pkgs.nodejs_22}/bin/node ${cliDist}/dist/app.js "$@"
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
