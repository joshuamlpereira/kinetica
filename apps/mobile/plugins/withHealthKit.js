// Expo config plugin: copies the in-tree HealthKit bridge into the generated
// iOS project, declares the entitlement and Info.plist usage description, and
// registers the source files on the Xcode project.
//
// app.json already injects the entitlement and Info.plist key; this plugin
// only handles the source file install + Xcode group registration. If the
// declarative app.json side covers a future Expo version cleanly, this plugin
// can shrink further.

const fs = require('node:fs');
const path = require('node:path');

const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');

const BRIDGE_DIR_NAME = 'HealthKitBridge';
const SOURCE_FILES = ['HealthKitBridge.swift', 'HealthKitBridge.m'];

function withCopyBridgeSources(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const src = path.join(projectRoot, 'ios-bridge');
      const projectName = cfg.modRequest.projectName;
      if (!projectName) {
        throw new Error('withHealthKit: cfg.modRequest.projectName is missing');
      }
      const dest = path.join(platformRoot, projectName, BRIDGE_DIR_NAME);

      fs.mkdirSync(dest, { recursive: true });
      for (const file of SOURCE_FILES) {
        const from = path.join(src, file);
        const to = path.join(dest, file);
        if (!fs.existsSync(from)) {
          throw new Error(`withHealthKit: missing bridge source ${from}`);
        }
        fs.copyFileSync(from, to);
      }
      return cfg;
    },
  ]);
}

function withRegisterBridgeOnXcode(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = cfg.modRequest.projectName;
    if (!projectName) {
      throw new Error('withHealthKit: cfg.modRequest.projectName is missing');
    }

    const groupPath = `${projectName}/${BRIDGE_DIR_NAME}`;
    let group = project.pbxGroupByName(BRIDGE_DIR_NAME);
    if (!group) {
      group = project.addPbxGroup([], BRIDGE_DIR_NAME, BRIDGE_DIR_NAME);
      const parent = project.pbxGroupByName(projectName);
      if (parent && group.uuid) {
        project.addToPbxGroup(group.uuid, parent.uuid);
      }
    }

    for (const file of SOURCE_FILES) {
      const target = `${groupPath}/${file}`;
      const isSource = file.endsWith('.m') || file.endsWith('.swift');
      if (isSource) {
        // Pass the group's uuid so xcode-node routes through addFile() rather
        // than addPluginFile(), which would mis-resolve the path.
        project.addSourceFile(
          target,
          { target: project.getFirstTarget().uuid },
          group.uuid,
        );
      }
    }
    return cfg;
  });
}

function withReactImportInBridgingHeader(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const projectName = cfg.modRequest.projectName;
      if (!projectName) {
        throw new Error('withHealthKit: cfg.modRequest.projectName is missing');
      }
      const headerPath = path.join(
        platformRoot,
        projectName,
        `${projectName}-Bridging-Header.h`,
      );
      if (!fs.existsSync(headerPath)) {
        throw new Error(`withHealthKit: bridging header missing at ${headerPath}`);
      }
      const importLine = '#import <React/RCTBridgeModule.h>';
      const current = fs.readFileSync(headerPath, 'utf8');
      if (!current.includes(importLine)) {
        fs.writeFileSync(headerPath, `${current.trimEnd()}\n\n${importLine}\n`);
      }
      return cfg;
    },
  ]);
}

module.exports = function withHealthKit(config) {
  config = withCopyBridgeSources(config);
  config = withReactImportInBridgingHeader(config);
  config = withRegisterBridgeOnXcode(config);
  return config;
};
