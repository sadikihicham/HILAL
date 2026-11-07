import Foundation
import SwiftUI

@main
struct HILALDeviceApp: App {
    var body: some Scene {
        WindowGroup {
            DeviceMonitorView()
        }
    }
}

private struct DeviceSnapshot {
    let osVersion: String
    let storageFree: Int64?
    let storageTotal: Int64?
    let memoryTotal: Int64?
    let logicalCores: Int?

    static func read() -> DeviceSnapshot {
        let process = ProcessInfo.processInfo
        let version = process.operatingSystemVersion
        let osVersion = "\(version.majorVersion).\(version.minorVersion).\(version.patchVersion)"
        let memory = Int64(exactly: process.physicalMemory).flatMap { $0 > 0 ? $0 : nil }
        let cores = process.processorCount > 0 ? process.processorCount : nil
        let url = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
        let values = try? url.resourceValues(forKeys: [
            .volumeAvailableCapacityKey, .volumeTotalCapacityKey,
        ])
        let free = values?.volumeAvailableCapacity.map(Int64.init)
        let total = values?.volumeTotalCapacity.map(Int64.init)
        if let free, let total, total > 0, free >= 0, free <= total {
            return DeviceSnapshot(osVersion: osVersion, storageFree: free,
                                  storageTotal: total, memoryTotal: memory, logicalCores: cores)
        }
        return DeviceSnapshot(osVersion: osVersion, storageFree: nil,
                              storageTotal: nil, memoryTotal: memory, logicalCores: cores)
    }
}

private struct DeviceMonitorView: View {
    @State private var snapshot = DeviceSnapshot(osVersion: "—", storageFree: nil,
                                                 storageTotal: nil, memoryTotal: nil, logicalCores: nil)

    private var language: String {
        let code = Locale.current.language.languageCode?.identifier ?? "en"
        return ["fr", "en", "ar"].contains(code) ? code : "en"
    }

    private func label(_ french: String, _ english: String, _ arabic: String) -> String {
        switch language {
        case "fr": french
        case "ar": arabic
        default: english
        }
    }

    private var deviceName: String {
        #if os(tvOS)
        label("Cette Apple TV", "This Apple TV", "جهاز Apple TV هذا")
        #else
        label("Ce Vision Pro", "This Vision Pro", "جهاز Vision Pro هذا")
        #endif
    }

    private var systemName: String {
        #if os(tvOS)
        "tvOS"
        #else
        "visionOS"
        #endif
    }

    private func formattedBytes(_ count: Int64) -> String {
        ByteCountFormatter.string(fromByteCount: count, countStyle: .file)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("HILAL")
                    .font(.largeTitle.bold())
                    .foregroundStyle(.yellow)

                Text(deviceName)
                    .font(.title2)

                VStack(alignment: .leading, spacing: 8) {
                    Text(label("Système", "System", "النظام"))
                        .foregroundStyle(.secondary)
                    Text("\(systemName) \(snapshot.osVersion)")
                        .font(.title3.weight(.semibold))
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(label("Stockage local", "Local storage", "التخزين المحلي"))
                        .foregroundStyle(.secondary)
                    if let free = snapshot.storageFree, let total = snapshot.storageTotal {
                        Text("\(formattedBytes(free)) / \(formattedBytes(total))")
                            .font(.title3.weight(.semibold))
                        Text(label("libre / total", "free / total", "متاح / إجمالي"))
                            .font(.caption)
                    } else {
                        Text(label("Mesure indisponible", "Measurement unavailable", "القياس غير متاح"))
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(label("Mémoire physique", "Physical memory", "الذاكرة الفعلية"))
                        .foregroundStyle(.secondary)
                    if let memory = snapshot.memoryTotal {
                        Text(formattedBytes(memory))
                            .font(.title3.weight(.semibold))
                    } else {
                        Text(label("Mesure indisponible", "Measurement unavailable", "القياس غير متاح"))
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(label("Cœurs logiques", "Logical cores", "الأنوية المنطقية"))
                        .foregroundStyle(.secondary)
                    if let cores = snapshot.logicalCores {
                        Text("\(cores)")
                            .font(.title3.weight(.semibold))
                    } else {
                        Text(label("Mesure indisponible", "Measurement unavailable", "القياس غير متاح"))
                    }
                }

                #if targetEnvironment(simulator)
                Text(label("Valeurs du simulateur", "Simulator values", "قيم المحاكي"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                #endif

                Button(label("Actualiser", "Refresh", "تحديث")) {
                    snapshot = .read()
                }
            }
            .frame(maxWidth: 700, alignment: .leading)
            .padding(32)
        }
        .task { snapshot = .read() }
    }
}
