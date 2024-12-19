{
  description = "Template for Holochain app development";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-24.11";
    holonix.url = "github:holochain/holonix/main-0.4";

    p2p-shipyard.url = "github:darksoil-studio/p2p-shipyard/main-0.4";
    tnesh-stack.url = "github:darksoil-studio/tnesh-stack/main-0.4";
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
          inputsFrom = [
            inputs.holonix.devShells.${system}.default
            inputs'.tnesh-stack.devShells.synchronized-pnpm
          ];
          packages = [ pkgs.nodejs_20 inputs'.p2p-shipyard.packages.hc-pilot ];
        };

        packages.hc-playground = let
          cliDist = pkgs.stdenv.mkDerivation (finalAttrs: {
            version = "0.400.0";
            pname = "holochain-playground-cli";
            src = (inputs.tnesh-stack.outputs.lib.cleanPnpmDepsSource {
              inherit lib;
            }) ./.;

            nativeBuildInputs = [ pkgs.nodejs pkgs.pnpm.configHook ];
            pnpmDeps = pkgs.pnpm.fetchDeps {
              inherit (finalAttrs) version pname src;

              hash = "sha256-8BbVkl/6o0jrywpElJ84iovywCLs3hoaJcfg3m5e028=";
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
