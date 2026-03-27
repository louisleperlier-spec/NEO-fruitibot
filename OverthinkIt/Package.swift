// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "OverthinkIt",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "OverthinkIt", targets: ["OverthinkIt"])
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "OverthinkIt",
            path: "Sources/OverthinkIt",
            resources: [
                .process("Assets.xcassets")
            ]
        )
    ]
)
