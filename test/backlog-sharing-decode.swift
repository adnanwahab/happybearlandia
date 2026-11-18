import Foundation
import CoreImage
let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let image = CIImage(data:data)!
let detector = CIDetector(ofType: CIDetectorTypeQRCode, context:nil, options:[CIDetectorAccuracy:CIDetectorAccuracyHigh])!
for feature in detector.features(in:image) { print((feature as! CIQRCodeFeature).messageString ?? "") }
