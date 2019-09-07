# A WebGL glTF library

## Project Status - This project is in a very alpha state and is not fully implemented yet

### Below is a table of all the working functionality from the [Sample Models]

| Sample Model               | Geometry      | Material   | Animations   |
| -------------------------- | ------------- | ---------- | ------------ |
| [2CylinderEngine]          | [x]           | [x]        |              |
| [AlphaBlendMode]           | [x]           | [ ]        |              |
| [AnimatedCube]             | [x]           | [x]        | [x]          |
| [AnimatedMorphCube]        | [x]           | [x]        | [x]          |
| [AnimatedMorphSphere]      | [x]           | [x]        | [x]          |
| [AnimatedTriangle]         | [x]           | [x]        | [?]          |
| [AnitqueCamera]            | [x]           | [?]        |              |
| [Avocado]                  | [x]           | [x]        |              |
| [BarramundiFish]           | [x]           | [x]        |              |
| [BoomBox]                  | [x]           | [x]        |              |
| [BoomBoxWithAxes]          | [x]           | [x]        |              |
| [Box]                      | [x]           | [x]        |              |
| [BoxAnimated]              | [x]           | [x]        | [x]          |
| [BoxInterleaved]           | [x]           | [x]        |              |
| [BoxTextured]              | [x]           | [x]        |              |
| [BoxTexturedNonPowerOfTwo] | [x]           | [x]        |              |
| [BoxVertexColors]          | [x]           | [?]        |              |
| [BrainStem]                | [x]           | [x]        | [x]          |
| [Buggy]                    | [x]           | [x]        |              |
| [Cameras]                  | [x]           | [x]        |              |
| [CesiumMan]                | [x]           | [x]        | [x]          |
| [CesiumMilkTruck]          | [x]           | [x]        | [x]          |
| [Corset]                   | [x]           | [x]        |              |
| [Cube]                     | [x]           | [x]        |              |
| [DamagedHelmet]            | [x]           | [x]        |              |
| [Duck]                     | [x]           | [x]        |              |
| [FlightHelmet]             | [x]           | [?]        |              |
| [GearboxAssy]              | [x]           | [x]        |              |
| [Lantern]                  | [x]           | [x]        |              |
| [MetalRoughSpheres]        | [x]           | [x]        |              |
| [Monster]                  | [x]           | [x]        | [x]          |
| [MultiUVTest]              | [x]           | [ ]        |              |
| [NormalTangentTest]        | [x]           | [x]        |              |
| [OrientationTest]          | [x]           | [x]        |              |
| [ReciprocatingSaw]         | [x]           | [x]        |              |
| [RiggedFigure]             | [x]           | [x]        | [x]          |
| [RiggedSimple]             | [x]           | [x]        | [x]          |
| [SciFiHelmet]              | [x]           | [x]        |              |
| [SimpleMeshes]             | [x]           | [x]        |              |
| [SimpleMorph]              | [x]           | [x]        | [x]          |
| [SimpleSparseAccessor]     | [ ]           | [ ]        |              |
| [SpecGlossVsMetalRough]    | [x]           | [ ]        |              |
| [Sponza]                   | [x]           | [ ]        |              |
| [Suzanne]                  | [x]           | [x]        |              |
| [TextureCoordinateTest]    | [x]           | [x]        |              |
| [TextureSettingsTest]      | [x]           | [x]        |              |
| [Triangle]                 | [x]           | [x]        |              |
| [TriangleWithoutIndices]   | [x]           | [x]        |              |
| [TwoSidedPlane]            | [x]           | [x]        |              |
| [VC]                       | [x]           | [x]        | [x]          |
| [VertexColorTest]          | [x]           | [x]        |              |
| [WaterBottle]              | [x]           | [x]        |              |

[Sample Models]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/
[2CylinderEngine]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/2CylinderEngine
[AlphaBlendModeTest]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/AlphaBlendModeTest
[AnimatedCube]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/AnimatedCube
[AnimatedMorphCube]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/AnimatedMorphCube
[AnimatedMorphSphere]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/AnimatedMorphSphere
[AnimatedTriangle]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/AnimatedTriangle
[AntiqueCamera]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/AntiqueCamera
[Avocado]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Avocado
[BarramundiFish]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/BarramundiFish
[BoomBox]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/BoomBox
[BoomBoxWithAxes]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/BoomBoxWithAxes
[Box]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Box
[BoxAnimated]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/BoxAnimated
[BoxInterleaved]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/BoxInterleaved
[BoxTextured]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/BoxTextured
[BoxTexturedNonPowerOfTwo]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/BoxTexturedNonPowerOfTwo
[BoxVertexColors]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/BoxVertexColors
[BrainStem]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/BrainStem
[Buggy]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Buggy
[Cameras]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Cameras
[CesiumMan]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/CesiumMan
[CesiumMilkTruck]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/CesiumMilkTruck
[Corset]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Corset
[Cube]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Cube
[DamagedHelmet]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/DamagedHelmet
[Duck]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Duck
[FlightHelmet]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/FlightHelmet
[GearboxAssy]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/GearboxAssy
[Lantern]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Lantern
[MetalRoughSpheres]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/MetalRoughSpheres
[Monster]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Monster
[MultiUVTest]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/MultiUVTest
[NormalTangentTest]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/NormalTangentTest
[OrientationTest]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/OrientationTest
[ReciprocatingSaw]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/ReciprocatingSaw
[RiggedFigure]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/RiggedFigure
[RiggedSimple]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/RiggedSimple
[SciFiHelmet]:https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/SciFiHelme
[SimpleMeshes]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/SimpleMeshes
[SimpleMorph]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/SimpleMorph
[SimpleSparseAccessor]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/SimpleSparseAccessor
[SpecGlossVsMetalRough]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/SpecGlossVsMetalRough
[Sponza]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Sponza
[Suzanne]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Suzanne
[TextureCoordinateTest]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/TextureCoordinateTest
[TextureSettingsTest]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/TextureSettingsTest
[Triangle]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Triangle
[TriangleWithoutIndices]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/TriangleWithoutIndices
[TwoSidedPlane]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/TwoSidedPlane
[VC]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/VC
[VertexColorTest]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/VertexColorTest
[WaterBottle]: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/WaterBottle
