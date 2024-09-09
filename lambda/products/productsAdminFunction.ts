import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Product, ProductRepository } from "./layers/productsLayer/nodejs/productRepository";
import { DynamoDB } from "aws-sdk";

const productsDdb = process.env.PRODUCTS_DDB!;
const ddbClient = new DynamoDB.DocumentClient();
const productRepository = new ProductRepository(ddbClient, productsDdb);

// Constants for status codes and error messages
const STATUS_CODES = {
  CREATED: 201,
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
    switch (event.resource) {
      case "/products":
        if (event.httpMethod === "POST") {
          return handleCreateProduct(event);
        }
        break;

      case "/products/{id}":
        return handleProductWithId(event);
    }

    return createResponse(STATUS_CODES.BAD_REQUEST, MESSAGES.BAD_REQUEST);
  } catch (error) {
    console.error("Unhandled error:", error);
    return createResponse(STATUS_CODES.BAD_REQUEST, MESSAGES.BAD_REQUEST);
  }
}

async function handleCreateProduct(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log("POST /products");

  const product = parseRequestBody<Product>(event.body);
  if (!product) {
    return createResponse(STATUS_CODES.BAD_REQUEST, MESSAGES.BAD_REQUEST);
  }

  const productCreated = await productRepository.create(product);
  return createResponse(STATUS_CODES.CREATED, productCreated);
}

async function handleProductWithId(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const productId = event.pathParameters?.id;
  if (!productId) {
    return createResponse(STATUS_CODES.BAD_REQUEST, MESSAGES.BAD_REQUEST);
  }

  switch (event.httpMethod) {
    case "PUT":
      return handleUpdateProduct(event, productId);

    case "DELETE":
      return handleDeleteProduct(productId);
  }

  return createResponse(STATUS_CODES.BAD_REQUEST, MESSAGES.BAD_REQUEST);
}

async function handleUpdateProduct(
  event: APIGatewayProxyEvent,
  productId: string
): Promise<APIGatewayProxyResult> {
  console.log(`PUT /products/${productId}`);

  const product = parseRequestBody<Product>(event.body);
  if (!product) {
    return createResponse(STATUS_CODES.BAD_REQUEST, MESSAGES.BAD_REQUEST);
  }

  try {
    const productUpdated = await productRepository.updateProduct(productId, product);
    return createResponse(STATUS_CODES.SUCCESS, productUpdated);
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      return createResponse(STATUS_CODES.NOT_FOUND, MESSAGES.PRODUCT_NOT_FOUND);
    }
    throw error;
  }
}

async function handleDeleteProduct(productId: string): Promise<APIGatewayProxyResult> {
  console.log(`DELETE /products/${productId}`);

  try {
    const product = await productRepository.deleteProduct(productId);
    return createResponse(STATUS_CODES.SUCCESS, product);
  } catch (error) {
    console.error("Delete error:", error);
    return createResponse(STATUS_CODES.NOT_FOUND, (error as Error).message);
  }
}

function parseRequestBody<T>(body: string | null): T | null {
  if (!body) return null;
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    console.error("Error parsing body:", error);
    return null;
  }
}

function isConditionalCheckFailed(error: any): boolean {
  return error.name === "ConditionalCheckFailedException";
}

function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
}
