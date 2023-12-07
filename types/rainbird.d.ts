import { EventEmitter } from 'events';

declare class RainBirdClass extends EventEmitter {
    constructor(ipAddress: string, password: string);
    setDebug(): void;
    setIp(ip: string): void;
    setPassword(password: string): void;

    getModelAndVersion(): Promise<ModelAndVersionResponse>;
    getTime(): Promise<CurrentTimeResponse>;
    getDate(): Promise<CurrentDateResponse>;
    getSerialNumber(): Promise<SerialNumberResponse>;
    getRainSensorState(): Promise<CurrentRainSensorStateResponse>;
    getRainDelay(): Promise<RainDelaySettingResponse>;
    getAvailableZones(): Promise<AvailableStationsResponse>;
    getIrrigationState(): Promise<CurrentIrrigationStateResponse>;
    getActiveZones(): Promise<CurrentStationsActiveResponse>;

    stopIrrigation(): Promise<AcknowledgeResponse>;
    setRainDelay(days: number): Promise<AcknowledgeResponse>;
    startZone(zone: number, minutes: number): Promise<AcknowledgeResponse>;
    startAllZones(minutes: number): Promise<AcknowledgeResponse>;
    startProgram(programNr: number): Promise<AcknowledgeResponse>;
}

interface AcknowledgeResponse {
    ack: boolean;
}

interface ModelAndVersionResponse {
    modelID: string;
    protocolRevisionMajor: string;
    protocolRevisionMinor: string;
}

interface CurrentTimeResponse {
    hour: string;
    minute: string;
    second: string;
}

interface CurrentDateResponse {
    day: string;
    month: string;
    year: string;
}

interface SerialNumberResponse {
    serialNumber: string;
}

interface CurrentRainSensorStateResponse {
    sensorState: string;
}

interface RainDelaySettingResponse {
    delaySetting: string;
}

interface AvailableStationsResponse {
    pageNumber: string;
    setStations: string;
}

interface CurrentIrrigationStateResponse {
    irrigationState: string;
}

interface CurrentStationsActiveResponse {
    pageNumber: string;
    activeStations: string;
    activeZones: number[];
}

export default RainBirdClass;
