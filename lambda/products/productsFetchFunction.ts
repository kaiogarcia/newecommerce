import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { ProductRepository } from "./layers/productsLayer/nodejs/productRepository";
import { DynamoDB } from "aws-sdk";

const productsDdb = process.env.PRODUCTS_DDB!;
const ddbClient = new DynamoDB.DocumentClient();
const productRepository = new ProductRepository(ddbClient, productsDdb);

// Constants for status codes and messages
const STATUS_CODES = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
};

const MESSAGES = {
  BAD_REQUEST: "Bad request",
  PRODUCT_NOT_FOUND: "Product not found",
};

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const lambdaRequestId = context.awsRequestId;
  const apiRequestId = event.requestContext.requestId;

  console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`);

  try {
    const { resource, httpMethod } = event;

    switch (resource) {
      case "/products":
        if (httpMethod === "GET") {
          return await handleGetAllProducts();
        }
        break;

      case "/products/{id}":
        return await handleGetProductById(event);
    }

    return createResponse(STATUS_CODES.BAD_REQUEST, { message: MESSAGES.BAD_REQUEST });
  } catch (error) {
    console.error("Unhandled error:", error);
    return createResponse(STATUS_CODES.BAD_REQUEST, { message: MESSAGES.BAD_REQUEST });
  }
}

async function handleGetAllProducts(): Promise<APIGatewayProxyResult> {
  console.log("GET /products");

  try {
    const products = await productRepository.getAllProducts();
    return createResponse(STATUS_CODES.SUCCESS, products);
  } catch (error) {
    console.error("Error fetching products:", error);
    return createResponse(STATUS_CODES.BAD_REQUEST, { message: MESSAGES.BAD_REQUEST });
  }
}

async function handleGetProductById(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const productId = event.pathParameters?.id;

  if (!productId) {
    console.error("Product ID is missing");
    return createResponse(STATUS_CODES.BAD_REQUEST, { message: MESSAGES.BAD_REQUEST });
  }

  console.log(`GET /products/${productId}`);

  try {
    const product = await productRepository.getProductById(productId);
    return createResponse(STATUS_CODES.SUCCESS, product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return createResponse(STATUS_CODES.NOT_FOUND, { message: MESSAGES.PRODUCT_NOT_FOUND });
  }
}

function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
}
