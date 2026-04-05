import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import "./ImageSourceTab.css";
import RayTracer from "../../../compute/raytracer";
import {ImageSourceSolver} from "../../../compute/raytracer/image-source/index";
import { emit, on } from "../../../messenger";
import { ObjectPropertyInputEvent } from "../../ObjectProperties";
import { useContainer, useSolver } from "../../../store";
import GridRow from "../../GridRow";
import TextInput from "../../text-input/TextInput";
import NumberInput from "../../number-input/NumberInput";
import { filteredMapObject, pickProps, unique } from "../../../common/helpers";
import GridRowSeperator from "../../GridRowSeperator";
import Select from 'react-select';
import useToggle from "../../hooks/use-toggle";
import { createPropertyInputs, useSolverProperty, PropertyButton  } from "../SolverComponents";
import PropertyRowFolder from "../property-row/PropertyRowFolder";
import PropertyRow from "../property-row/PropertyRow";
import PropertyRowLabel from "../property-row/PropertyRowLabel";
import PropertyRowCheckbox from "../property-row/PropertyRowCheckbox";
import PropertyRowButton from "../property-row/PropertyRowButton";
import shallow from "zustand/shallow";
import { NetworkConfig } from "./NetworkConfig";
import { TransmissionStatus } from "./TransmissionStatus";
import Source, { DirectivityHandler } from "../../../objects/source";
import { applyClfArrayBufferToSource, applyClfTextToSource } from "./clf-import";
import { DEFAULT_IMAGE_SOURCE_CLF } from "../../../res/clf/default-image-source-directivity";

export interface ImageSourceTabProps {
  uuid: string;
}

export const ReceiverSelect = ({ uuid }: { uuid: string }) => {
  const receivers = useContainer((state) => {
    return filteredMapObject(state.containers, (container) =>
      container.kind === "receiver" ? pickProps(["uuid", "name"], container) : undefined
    ) as { uuid: string; name: string }[];
  });

  const [receiverIDs, setReceiverIDs] = useSolverProperty<ImageSourceSolver, "receiverIDs">(
    uuid,
    "receiverIDs",
    "IMAGESOURCE_SET_PROPERTY"
  );

  return (
    <>
      {receivers.map((rec) => (
        <PropertyRow key={rec.uuid}>
          <PropertyRowLabel label={rec.name} hasToolTip={false} />
          <PropertyRowCheckbox
            value={receiverIDs.includes(rec.uuid)}
            onChange={(e) =>
              setReceiverIDs({
                value: e.value ? [...receiverIDs, rec.uuid] : receiverIDs.filter((x) => x !== rec.uuid)
              })
            }
          />
        </PropertyRow>
      ))}
    </>
  );
};
export const SourceSelect = ({ uuid }: { uuid: string }) => {
  const sources = useContainer((state) => {
    return filteredMapObject(state.containers, (container) =>
      container.kind === "source" ? pickProps(["uuid", "name"], container) : undefined
    ) as { uuid: string; name: string }[];
  });

  const [sourceIDs, setSourceIDs] = useSolverProperty<ImageSourceSolver, "sourceIDs">(
    uuid,
    "sourceIDs",
    "IMAGESOURCE_SET_PROPERTY"
  );

  return (
    <>
      {sources.map((src) => (
        <PropertyRow key={src.uuid}>
          <PropertyRowLabel label={src.name} hasToolTip={false} />
          <PropertyRowCheckbox
            value={sourceIDs.includes(src.uuid)}
            onChange={(e) =>
              setSourceIDs({
                value: e.value ? [...sourceIDs, src.uuid] : sourceIDs.filter((x) => x !== src.uuid)
              })
            }
          />
        </PropertyRow>
      ))}
    </>
  );
};


const { PropertyTextInput, PropertyNumberInput, PropertyCheckboxInput } = createPropertyInputs<ImageSourceSolver>(
  "IMAGESOURCE_SET_PROPERTY"
);


const General = ({ uuid }: { uuid: string }) => {
  const [open, toggle] = useToggle(true);
  return (
    <PropertyRowFolder label="General" open={open} onOpenClose={toggle}>
      <PropertyTextInput uuid={uuid} label="Name" property="name" tooltip="Sets the name of this solver" />
    </PropertyRowFolder>
  );
};

const Calculation = ({ uuid }: { uuid: string}) => {
  const [open, toggle] = useToggle(true);
  const {sourceIDs, receiverIDs} = useSolver(state=>pickProps(["sourceIDs", "receiverIDs"], state.solvers[uuid] as ImageSourceSolver));
  const disabled = !(sourceIDs.length > 0 && receiverIDs.length > 0);
  const [, forceUpdate] = useReducer((c) => c + 1, 0) as [never, () => void]
  useEffect(()=>on("IMAGESOURCE_SET_PROPERTY", (e)=>{
    if(e.uuid === uuid && (e.property === "sourceIDs" || e.property === "receiverIDs")){
      forceUpdate();
    }
  }))
  return (
    <PropertyRowFolder label="Calculation" open={open} onOpenClose={toggle}>
      <PropertyNumberInput uuid={uuid} label="Maximum Order" property="maxReflectionOrderReset" tooltip="Sets the maximum reflection order"/>
      <PropertyButton disabled={disabled} event="UPDATE_IMAGESOURCE" args={uuid} label="Update" tooltip="Updates Imagesource Calculation" />
      <PropertyButton disabled={disabled} event="RESET_IMAGESOURCE" args={uuid} label="Clear" tooltip="Clears Imagesource Calculation" />
    </PropertyRowFolder>
  );
}

const SourceConfiguration = ({ uuid }: { uuid: string}) => {
  const [open, toggle] = useToggle(true);
  return (
    <PropertyRowFolder label="Source Configuration" open={open} onOpenClose={toggle}>
      <SourceSelect uuid={uuid} />
    </PropertyRowFolder>
  );
}

const ReceiverConfiguration = ({ uuid }: { uuid: string}) => {
  const [open, toggle] = useToggle(true);
  return (
    <PropertyRowFolder label="Receiver Configuration" open={open} onOpenClose={toggle}>
      <ReceiverSelect uuid={uuid} />
    </PropertyRowFolder>
  );
}

const SourceDirectivityConfiguration = ({ uuid }: { uuid: string }) => {
  const [open, toggle] = useToggle(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualClfText, setManualClfText] = useState(DEFAULT_IMAGE_SOURCE_CLF);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [statusMessage, setStatusMessage] = useState("Built-in example CLF loaded");
  const [refreshTick, setRefreshTick] = useState(0);

  const [sourceIDs, setSourceIDs] = useSolverProperty<ImageSourceSolver, "sourceIDs">(
    uuid,
    "sourceIDs",
    "IMAGESOURCE_SET_PROPERTY"
  );
  const sources = useContainer((state) => {
    return filteredMapObject(state.containers, (container) =>
      container.kind === "source" ? (container as Source) : undefined
    ) as Source[];
  });

  useEffect(() => {
    if (!selectedSourceId && sources.length > 0) {
      setSelectedSourceId(sources[0].uuid);
    }

    if (selectedSourceId && !sources.some((source) => source.uuid === selectedSourceId)) {
      setSelectedSourceId(sources[0]?.uuid || "");
    }
  }, [selectedSourceId, sources]);

  const handleSelectedSourceChange = (nextSourceId: string) => {
    setSelectedSourceId(nextSourceId);
    if (!nextSourceId || sourceIDs.includes(nextSourceId)) {
      return;
    }

    setSourceIDs({
      value: [...sourceIDs, nextSourceId]
    });
    const source = sources.find((item) => item.uuid === nextSourceId);
    setStatusMessage(source ? `Linked source to solver: ${source.name}` : "Linked source to solver");
  };

  const selectedSource = sources.find((source) => source.uuid === selectedSourceId) || null;
  const directivitySummary = selectedSource
    ? `${selectedSource.directivityLabel || "Omni"} | Type=${
        selectedSource.directivityHandler && selectedSource.directivityHandler.sourceDirType !== undefined
          ? selectedSource.directivityHandler.sourceDirType
          : 0
      }`
    : "No source selected";

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("loadend", () => {
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".cf1") || lowerName.endsWith(".cf2")) {
        if (!selectedSource) {
          setStatusMessage("Select a source before importing a binary CLF file.");
          return;
        }

        try {
          applyClfArrayBufferToSource(selectedSource, reader.result as ArrayBuffer);
          setStatusMessage(`Imported official CLF distribution: ${file.name}`);
          setRefreshTick((value) => value + 1);
          setDialogOpen(false);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setStatusMessage(`Failed to import ${file.name}: ${message}`);
        }
        return;
      }

      setManualClfText((reader.result as string) || "");
      setStatusMessage(`Loaded CLF text: ${file.name}`);
    });

    if (file.name.toLowerCase().endsWith(".cf1") || file.name.toLowerCase().endsWith(".cf2")) {
      reader.readAsArrayBuffer(file);
      return;
    }

    reader.readAsText(file);
  };

  const loadBuiltInExample = () => {
    setManualClfText(DEFAULT_IMAGE_SOURCE_CLF);
    setStatusMessage("Built-in example CLF loaded");
  };

  const applyClfText = () => {
    if (!selectedSource) {
      setStatusMessage("Select a source before applying CLF.");
      return;
    }

    if (!manualClfText.trim()) {
      setStatusMessage("CLF text is empty.");
      return;
    }

    try {
      applyClfTextToSource(selectedSource, manualClfText);
      setStatusMessage(`Applied CLF to source: ${selectedSource.name}`);
      setRefreshTick((value) => value + 1);
      setDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Failed to apply CLF: ${message}`);
    }
  };

  const resetToOmni = () => {
    if (!selectedSource) {
      setStatusMessage("Select a source before resetting directivity.");
      return;
    }

    selectedSource.directivityHandler = new DirectivityHandler(0);
    selectedSource.directivityLabel = "Omni";
    setStatusMessage(`Reset source to omni: ${selectedSource.name}`);
    setRefreshTick((value) => value + 1);
  };

  return (
    <PropertyRowFolder label="Source Directivity" open={open} onOpenClose={toggle}>
      <PropertyRow>
        <PropertyRowLabel label="Target Source" tooltip="Choose which assigned source receives the CLF directivity data" />
        <select
          value={selectedSourceId}
          onChange={(event) => handleSelectedSourceChange(event.currentTarget.value)}
          disabled={sources.length === 0}
        >
          {sources.length === 0 && <option value="">No source selected</option>}
          {sources.map((source) => (
            <option key={source.uuid} value={source.uuid}>
              {source.name}
            </option>
          ))}
        </select>
      </PropertyRow>
      <PropertyRow key={refreshTick}>
        <PropertyRowLabel label="Current Mode" hasToolTip={false} />
        <div>{directivitySummary}</div>
      </PropertyRow>
      <PropertyRow>
        <PropertyRowLabel label="Status" hasToolTip={false} />
        <div>{statusMessage}</div>
      </PropertyRow>
      <PropertyRow>
        <PropertyRowLabel label="Open CLF Window" tooltip="Open a manual CLF input window for the selected source" />
        <PropertyRowButton onClick={() => setDialogOpen(true)} label="Open CLF Window" disabled={sources.length === 0} />
      </PropertyRow>
      <PropertyRow>
        <PropertyRowLabel label="Reset To Omni" tooltip="Reset the selected source directivity back to omni" />
        <PropertyRowButton onClick={() => resetToOmni()} label="Reset To Omni" disabled={sources.length === 0} />
      </PropertyRow>

      {dialogOpen && (
        <div className="imagesource-directivity-modal">
          <div className="imagesource-directivity-modal__panel">
            <h3>Manual CLF Input</h3>
            <p>Load a text `.tab` CLF file, import an official binary `.CF1/.CF2` distribution file, or paste CLF text manually.</p>
            <input type="file" accept=".tab,.cf1,.cf2,.CF1,.CF2" onChange={handleFileChange} />
            <div className="imagesource-directivity-modal__actions imagesource-directivity-modal__actions--top">
              <button type="button" onClick={loadBuiltInExample}>
                Load Built-in Example
              </button>
            </div>
            <textarea
              className="imagesource-directivity-modal__textarea"
              value={manualClfText}
              onChange={(event) => setManualClfText(event.currentTarget.value)}
              placeholder="Paste CLF file content here"
            />
            <div className="imagesource-directivity-modal__actions">
              <button type="button" onClick={applyClfText}>
                Apply CLF
              </button>
              <button type="button" onClick={() => setDialogOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PropertyRowFolder>
  );
};

const Graphing = ({ uuid }: { uuid: string}) => {
  const [open, toggle] = useToggle(true);
  return (
    <PropertyRowFolder label="Graphing" open={open} onOpenClose={toggle}>
      <PropertyCheckboxInput uuid={uuid} label="Show Sources" property="imageSourcesVisible" tooltip="Shows/Hides Image Sources"/>
      <PropertyCheckboxInput uuid={uuid} label="Show Paths" property="rayPathsVisible" tooltip="Shows/Hides Ray Paths"/>
    </PropertyRowFolder>
  );
}

const ImpulseResponse = ({uuid}: { uuid: string}) => {
  const [open, toggle] = useToggle(true);
  return (
    <PropertyRowFolder label="Impulse Response" open={open} onOpenClose={toggle}>
      <PropertyButton event="IMAGESOURCE_PLAY_IR" args={uuid} label="Play" tooltip="Plays the calculated impulse response" disabled={false} />
      <PropertyButton event="IMAGESOURCE_DOWNLOAD_IR" args={uuid} label="Download" tooltip="Plays the calculated impulse response" />
    </PropertyRowFolder>
  )
}

const DataExport = ({uuid}: { uuid: string}) => {
  const [open, toggle] = useToggle(true);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Listen to calculation complete event for immediate UI update
  useEffect(() => {
    const handler = (event: EventTypes["IMAGESOURCE_CALCULATION_COMPLETE"]) => {
      if (event.uuid === uuid) {
        console.log("🎯 Calculation complete event received:", event);
        setUpdateTrigger(prev => prev + 1);
      }
    };
    on("IMAGESOURCE_CALCULATION_COMPLETE", handler);
  }, [uuid]);

  // Subscribe to solver state with shallow comparison for better reactivity
  const { validPathsCount, totalPathsCount, updateCounter } = useSolver(
    (state) => {
      const solver = state.solvers[uuid] as ImageSourceSolver;
      return {
        validPathsCount: solver?.validRayPaths?.length || 0,
        totalPathsCount: solver?.allRayPaths?.length || 0,
        updateCounter: solver?._pathsUpdateCounter || 0
      };
    },
    shallow
  );

  console.log("📊 DataExport render - Valid:", validPathsCount, "Total:", totalPathsCount, "Counter:", updateCounter, "Trigger:", updateTrigger);

  return (
    <PropertyRowFolder label="Data Export" open={open} onOpenClose={toggle}>
      <PropertyRow>
        <PropertyRowLabel label={`Valid Paths: ${validPathsCount} / ${totalPathsCount}`} hasToolTip={false} />
      </PropertyRow>
      <PropertyButton
        event="IMAGESOURCE_EXPORT_PATHS"
        args={uuid}
        label="Export Ray Paths (JSON)"
        tooltip="Export all ray path data including reflections, attenuation, and image sources"
        disabled={validPathsCount === 0}
      />
    </PropertyRowFolder>
  );
}

const Developer = ({ uuid }: { uuid: string}) => {
  const [open, toggle] = useToggle(true);
  return (
    <PropertyRowFolder label="Developer" open={open} onOpenClose={toggle}>
      <PropertyButton event="CALCULATE_LTP" args={uuid} label="Calculate LTP" tooltip="Calculates Level Time Progression"/>
    </PropertyRowFolder>
  );
}
export const ImageSourceTab = ({ uuid }: ImageSourceTabProps) => {
  const [directPathOnly, setDirectPathOnly] = useState(false);

  // Handler for network transmission
  const handleSendToNetwork = () => {
    const solver = useSolver.getState().solvers[uuid] as ImageSourceSolver;
    if (solver) {
      try {
        solver.sendToNetwork({ directPathOnly });
      } catch (error) {
        console.error("Error sending to network:", error);
        alert(`Failed to send data: ${error.message}`);
      }
    }
  };

  return (
    <div>
      <General uuid={uuid} />
      <Calculation uuid={uuid}/>
      <SourceConfiguration uuid={uuid}/>
      <SourceDirectivityConfiguration uuid={uuid} />
      <ReceiverConfiguration uuid={uuid}/>
      <Graphing uuid={uuid}/>
      <ImpulseResponse uuid={uuid}/>
      <DataExport uuid={uuid}/>
      <NetworkConfig />
      <div style={{ padding: '8px 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={directPathOnly}
            onChange={(e) => setDirectPathOnly(e.target.checked)}
          />
          仅直达声（过滤所有反射，只发送 order=0 路径）
        </label>
      </div>
      <TransmissionStatus uuid={uuid} onSendToNetwork={handleSendToNetwork} />
      <Developer uuid={uuid}/>
    </div>
  );
};

export default ImageSourceTab;
