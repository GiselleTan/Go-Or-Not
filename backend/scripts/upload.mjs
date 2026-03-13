import proj4 from 'proj4';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
const svy21 = "+proj=tmerc +lat_0=1.366666666666667 +lon_0=103.8333333333333 +k=1 +x_0=28001.642 +y_0=38744.572 +ellps=WGS84 +units=m +no_defs";
const wgs84 = "EPSG:4326";

const client = new DynamoDBClient({ 
  region: "ap-southeast-1",
  endpoint: "http://localhost:8000" 
});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "carpark-metadata-dev";

async function upload() {
  try {
    const csvData = fs.readFileSync('./HDBCarparkInformation.csv', 'utf-8');
    const records = parse(csvData, { columns: true, skip_empty_lines: true });

    console.log(`🚀 Seeding ${records.length} carparks into ${TABLE_NAME}...`);

    let addedCount = 0;
    let skippedCount = 0;

    for (const row of records) {
      const x = parseFloat(row['x_coord']);
      const y = parseFloat(row['y_coord']);

      if (!isNaN(x) && !isNaN(y)) {
        const [lon, lat] = proj4(svy21, wgs84, [x, y]);      
        const item = { ...row };
        
        // Ensure consistent ID naming
        item.carpark_number = row['car_park_no'];
        item.latitude = lat;
        item.longitude = lon;
        item.gantry_height = parseFloat(row['gantry_height']) || 0;
        item.car_park_decks = parseInt(row['car_park_decks']) || 0;

        // Check existence
        const existing = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { carpark_number: item.carpark_number }
        }));

        if (!existing.Item) {
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: item
            }));
            addedCount++;
        } else {
            skippedCount++;
        }
      }
    }

    if (addedCount === 0 && skippedCount > 0) {
        console.log(`ℹ️ Table '${TABLE_NAME}' already exists and is fully populated.`);
    } else {
        console.log(`✅ Success! Added: ${addedCount}, Skipped (already exists): ${skippedCount}.`);
    }

  } catch (err) {
    console.error("❌ Error during seeding:", err.message);
  }
}

upload();