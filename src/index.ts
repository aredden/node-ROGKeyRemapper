/** @format */

import * as hid from "node-hid";
import Shell from "node-powershell";
import assert from "assert";
import readline from "readline";
import {
  Worker,
  isMainThread,
  MessageChannel,
  MessagePort,
  parentPort,
} from "worker_threads";
import { getLogger } from "./Logger";
import {
  ASUSACCI_PATH,
  ARMSOCK_SERV,
  ARMSOCK_SERV_PATH,
  ARMCRATE_INTERFACE,
  ARMCRATE_KEY_CTRL,
  ARMORY_SW_AGENT,
  ARMORY_SW_AGENT_PATH,
  ARMCRATE_SVC,
  ARMCRATE_SVC_PATH,
  ARMCRATE_SESS_HELPER,
  ARMCRATE_MANAGER,
  ARMCRATE_MANAGER_AGENT,
} from "./constants";
import { undoAllRenames } from "./utilities";

const LOGGER = new getLogger("HIDControl");

let ps = new Shell({
  executionPolicy: "Bypass",
  noProfile: true,
});

export const checkExecutableAtPathExists = (name: string, path: string) => {
  return new Promise((resolve) => {
    let ps = new Shell({
      executionPolicy: "Bypass",
      noProfile: true,
    });
    ps.addCommand(`Test-Path "${path}/${name}" -PathType Leaf`);
    ps.invoke()
      .then((result) => {
        if (result.indexOf("False") !== -1) {
          LOGGER.info(`Did not find file ${name} at path: "${path}"`);
          resolve(false);
        } else {
          LOGGER.info(`Found file ${name} at path: "${path}"`);
          resolve(true);
        }
      })
      .catch((err) => {
        LOGGER.info("Error checking path exists: " + err);
        resolve(false);
      });
  });
};

export const checkAndRemove = (name: string, path?: string) => {
  return new Promise((resolve) => {
    if (path) {
      checkExecutableAtPathExists(name, path).then((ok) => {
        if (ok) {
          renameProcess(name, name + "_disabled", path).then((result) => {
            checkProcessExist(name).then((result) => {
              if (result) {
                killProcess(name).then((result) => {
                  resolve(true);
                });
              } else {
                resolve(true);
              }
            });
          });
        } else {
          LOGGER.info(
            `${name} at "${path}" has already been renamed to name.exe_disabled or does not exist.`
          );
          checkProcessExist(name).then((result) => {
            if (result) {
              killProcess(name).then((resolved) => {
                resolve(true);
              });
            } else {
              resolve(true);
            }
          });
        }
      });
    } else {
      checkProcessExist(name).then((result) => {
        if (result) {
          killProcess(name).then((result) => {
            resolve(true);
          });
        } else {
          resolve(true);
        }
      });
    }
  });
};

export const checkProcessExist = async (executableName: string) => {
  return new Promise((resolve) => {
    let ps = new Shell({
      executionPolicy: "Bypass",
      noProfile: true,
    });
    ps.addCommand(
      `Get-Process | Where-Object Name -like "${executableName.replace(
        ".exe",
        ""
      )}" | Select-Object ProcessName`
    );
    ps.invoke()
      .then((result) => {
        if (result.length > 0) {
          LOGGER.info(
            `Result of checkProcessExists(): Process ${executableName} is running!`
          );
          resolve(true);
        } else {
          LOGGER.info(
            `Result of checkProcessExists(): Process ${executableName} is not running.`
          );
          resolve(false);
        }
      })
      .catch((err) => {
        LOGGER.error(
          `Error checking process named: ${executableName}, had error: \n${err}`
        );
        resolve(false);
      });
  });
};

export const killProcess = async (executablename: string) => {
  let ps = new Shell({
    executionPolicy: "Bypass",
    noProfile: true,
  });
  return new Promise((resolve) => {
    ps.addCommand(`taskkill /F /IM ${executablename}`);
    ps.invoke()
      .then((success) => {
        if (success) {
          LOGGER.info(
            "Successully killed process with message: " +
              success.replace("\n", "")
          );
          resolve(true);
        } else {
          LOGGER.error(
            "Failed to kill process (or something idk but no error):\n" +
              success
          );
          resolve(true);
        }
      })
      .catch((error) => {
        LOGGER.error("Failed to kill process. Error:\n" + error);
        resolve(false);
      });
  });
};

export const renameProcess = async (
  executableName: string,
  newName: string,
  path = ASUSACCI_PATH
) => {
  let ps = new Shell({
    executionPolicy: "Bypass",
    noProfile: true,
  });
  return new Promise((resolve) => {
    ps.addCommand(`ren "${path}/${executableName}" ${newName}`);
    ps.invoke()
      .then((result) => {
        if (result) {
          LOGGER.info("Failed to rename process (or something idk)" + result);
          resolve(true);
        } else {
          LOGGER.info(
            "Successfully renamed " + executableName + " to " + newName
          );
          LOGGER.info(
            "Will now check that execuatable path expected exists..."
          );
          checkExecutableAtPathExists(newName, path).then((result) => {
            if (result) {
              resolve(true);
            } else {
              resolve(false);
            }
          });
        }
      })
      .catch((error) => {
        LOGGER.error("Failed to rename process. Error:\n" + error);
        resolve(false);
      });
  });
};

// Remaps the key to listen to whatever callback it is given.
export const setUpNewG14ControlKey = (cb: (data: Buffer) => any) => {
  let hidDevice: hid.HID;
  let devices = hid.devices();
  let deviceInfo = devices.find(function (d: hid.Device) {
    let kbd = d.vendorId === 0x0b05 && d.productId === 0x1866;
    if (kbd && d.path.includes("col01")) {
      return true;
    } else {
      return false;
    }
  });
  if (deviceInfo) {
    hidDevice = new hid.HID(deviceInfo.path);
    hidDevice.on("data", cb);
  }
};

// undoAllRenames().then((r) => LOGGER.info("hok"));
if (isMainThread) {
  let devices = hid.devices();
  let deviceInfo = devices.find(function (d: hid.Device) {
    let kbd = d.vendorId === 0x0b05 && d.productId === 0x1866;
    if (kbd && d.path.includes("col01")) {
      return true;
    } else {
      return false;
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let subChannel = new MessageChannel();
  let worker = new Worker(__filename);
  worker.postMessage({ childPort: subChannel.port1, tid: worker.threadId }, [
    subChannel.port1,
  ]);
  subChannel.port2.on("message", (value: any) => {
    if (value === "Done") {
      worker.terminate().then((td) => {
        console.log("Worker terminated, code: " + td);
      });
      setUpNewG14ControlKey((data) => {
        data.toJSON();
        if (data.toJSON().data[1] === 56) {
          LOGGER.info("ROG_KEY\n");

          // INSERT CUSTOM LOGIC

          rl.question("\nUndo changes? (y/n)", (ans) => {
            if (ans === "y") {
              undoAllRenames().then((done) => {
                LOGGER.info(
                  "Renames completed... You can now restart to reenable rog key."
                );
              });
            }
          });
        }
      });
    }
  });
} else {
  parentPort.once("message", async (value) => {
    assert(value.childPort instanceof MessagePort);
    LOGGER.info("Child got message tid: " + value.tid);
    let thing1 = await checkAndRemove(ARMCRATE_INTERFACE, ASUSACCI_PATH);
    let thing2 = await checkAndRemove(ARMCRATE_KEY_CTRL, ASUSACCI_PATH);
    let thing3 = await checkAndRemove(ARMORY_SW_AGENT, ARMORY_SW_AGENT_PATH);
    let thing4 = await checkAndRemove(ARMCRATE_SESS_HELPER, ARMCRATE_SVC_PATH);
    let thing5 = await checkAndRemove(ARMCRATE_SVC, ARMCRATE_SVC_PATH);
    let thing6 = await checkAndRemove(ARMSOCK_SERV, ARMSOCK_SERV_PATH);
    let thing7 = await checkAndRemove(ARMCRATE_MANAGER);
    let thing8 = await checkAndRemove(ARMCRATE_MANAGER_AGENT);
    value.childPort.postMessage("Done");
  });
}
