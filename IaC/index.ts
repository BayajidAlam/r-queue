import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Create a VPC
const vpc = new aws.ec2.Vpc("redis-vpc", {
    cidrBlock: "10.0.0.0/16",
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
        Name: "redis-vpc",
    },
});
export const vpcId = vpc.id;

// Create public subnets in one availability zone
const publicSubnet1 = new aws.ec2.Subnet("public-subnet-1", {
    vpcId: vpc.id,
    cidrBlock: "10.0.1.0/24",
    availabilityZone: "ap-southeast-1a",
    mapPublicIpOnLaunch: true,
    tags: {
        Name: "public-subnet-1",
    },
});
export const publicSubnet1Id = publicSubnet1.id;

// Create private subnets in two availability zones
const privateSubnet1 = new aws.ec2.Subnet("private-subnet-1", {
    vpcId: vpc.id,
    cidrBlock: "10.0.2.0/24",
    availabilityZone: "ap-southeast-1b",
    mapPublicIpOnLaunch: false,
    tags: {
        Name: "private-subnet-1",
    },
});
export const privateSubnet1Id = privateSubnet1.id;

const privateSubnet2 = new aws.ec2.Subnet("private-subnet-2", {
    vpcId: vpc.id,
    cidrBlock: "10.0.3.0/24",
    availabilityZone: "ap-southeast-1c",
    mapPublicIpOnLaunch: false,
    tags: {
        Name: "private-subnet-2",
    },
});
export const privateSubnet2Id = privateSubnet2.id;

// Create an Internet Gateway
const internetGateway = new aws.ec2.InternetGateway("redis-igw", {
    vpcId: vpc.id,
    tags: {
        Name: "redis-igw",
    },
});
export const igwId = internetGateway.id;

// Create an EIP for NAT Gateway
const natEip = new aws.ec2.Eip("nat-eip", {
    vpc: true,
    tags: {
        Name: "nat-eip",
    },
});

// Create a NAT Gateway
const natGateway = new aws.ec2.NatGateway("redis-nat", {
    allocationId: natEip.id,
    subnetId: publicSubnet1.id,
    tags: {
        Name: "redis-nat",
    },
});

// Create Public Route Table
const publicRouteTable = new aws.ec2.RouteTable("public-rt", {
    vpcId: vpc.id,
    tags: {
        Name: "public-rt",
    },
});
export const publicRouteTableId = publicRouteTable.id;

// Create Private Route Table
const privateRouteTable = new aws.ec2.RouteTable("private-rt", {
    vpcId: vpc.id,
    tags: {
        Name: "private-rt",
    },
});
export const privateRouteTableId = privateRouteTable.id;

// Create routes
const publicRoute = new aws.ec2.Route("public-route", {
    routeTableId: publicRouteTable.id,
    destinationCidrBlock: "0.0.0.0/0",
    gatewayId: internetGateway.id,
});

const privateRoute = new aws.ec2.Route("private-route", {
    routeTableId: privateRouteTable.id,
    destinationCidrBlock: "0.0.0.0/0",
    natGatewayId: natGateway.id,
});

// Associate Route Tables
const publicRtAssociation = new aws.ec2.RouteTableAssociation("public-rt-association", {
    subnetId: publicSubnet1.id,
    routeTableId: publicRouteTable.id,
});

const privateRtAssociation1 = new aws.ec2.RouteTableAssociation("private-rt-association-1", {
    subnetId: privateSubnet1.id,
    routeTableId: privateRouteTable.id,
});

const privateRtAssociation2 = new aws.ec2.RouteTableAssociation("private-rt-association-2", {
    subnetId: privateSubnet2.id,
    routeTableId: privateRouteTable.id,
});

// Create Security Groups
interface SecurityGroupRule {
    protocol: string;
    fromPort: number;
    toPort: number;
    cidrBlocks: string[];
}

const publicSecurityGroup = new aws.ec2.SecurityGroup("public-secgrp", {
    vpcId: vpc.id,
    description: "Allow inbound traffic for public instances",
    ingress: [
        { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },  // SSH
        { protocol: "tcp", fromPort: 3000, toPort: 3000, cidrBlocks: ["0.0.0.0/0"] },  // Node.js
        { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },  // HTTP
        { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },  // HTTPS
    ],
    egress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
    ],
    tags: {
        Name: "public-secgrp",
    },
});

const redisSecurityGroup = new aws.ec2.SecurityGroup("redis-secgrp", {
    vpcId: vpc.id,
    description: "Allow Redis traffic from public subnet",
    ingress: [
        { protocol: "tcp", fromPort: 6379, toPort: 6379, cidrBlocks: ["10.0.1.0/24"] },  // Redis
        { protocol: "tcp", fromPort: 16379, toPort: 16379, cidrBlocks: ["10.0.1.0/24"] },  // Redis Cluster
        { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["10.0.1.0/24"] },  // SSH from public subnet
    ],
    egress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
    ],
    tags: {
        Name: "redis-secgrp",
    },
});

export const publicSecurityGroupId = publicSecurityGroup.id;
export const redisSecurityGroupId = redisSecurityGroup.id;

// Define an AMI for the EC2 instances
const amiId: string = "ami-01811d4912b4ccb26";  // Ubuntu 24.04 LTS

// Create instances in public subnet
interface EC2InstanceArgs {
    instanceType: string;
    vpcSecurityGroupIds: pulumi.Input<string>[];
    ami: string;
    subnetId: pulumi.Input<string>;
    keyName: string;
    associatePublicIpAddress: boolean;
    tags: {
        [key: string]: string;
    };
}

const nodejsInstance = new aws.ec2.Instance("nodejs-instance", {
    instanceType: "t2.micro",
    vpcSecurityGroupIds: [publicSecurityGroup.id],
    ami: amiId,
    subnetId: publicSubnet1.id,
    keyName: "MyKeyPair",
    associatePublicIpAddress: true,
    tags: {
        Name: "nodejs-instance",
        Environment: "Development",
        Project: "RedisSetup"
    },
});

const frontendInstance = new aws.ec2.Instance("frontend-instance", {
    instanceType: "t2.micro",
    vpcSecurityGroupIds: [publicSecurityGroup.id],
    ami: amiId,
    subnetId: publicSubnet1.id,
    keyName: "MyKeyPair",
    associatePublicIpAddress: true,
    tags: {
        Name: "frontend-instance",
        Environment: "Development",
        Project: "RedisSetup"
    },
});

// Helper function to create Redis instances
const createRedisInstance = (name: string, subnetId: pulumi.Input<string>): aws.ec2.Instance => {
    return new aws.ec2.Instance(name, {
        instanceType: "t2.micro",
        vpcSecurityGroupIds: [redisSecurityGroup.id],
        ami: amiId,
        subnetId: subnetId,
        keyName: "MyKeyPair",
        associatePublicIpAddress: false,
        tags: {
            Name: name,
            Environment: "Development",
            Project: "RedisSetup"
        },
    });
};

// Create Redis Cluster Instances in private subnets
const redisInstance1 = createRedisInstance("redis-instance-1", privateSubnet1.id);
const redisInstance2 = createRedisInstance("redis-instance-2", privateSubnet1.id);
const redisInstance3 = createRedisInstance("redis-instance-3", privateSubnet1.id);
const redisInstance4 = createRedisInstance("redis-instance-4", privateSubnet2.id);
const redisInstance5 = createRedisInstance("redis-instance-5", privateSubnet2.id);
const redisInstance6 = createRedisInstance("redis-instance-6", privateSubnet2.id);

// Export instance details
export const nodejsInstanceId = nodejsInstance.id;
export const nodejsInstancePublicIp = nodejsInstance.publicIp;
export const frontendInstanceId = frontendInstance.id;
export const frontendInstancePublicIp = frontendInstance.publicIp;
export const redisInstance1Id = redisInstance1.id;
export const redisInstance1PrivateIp = redisInstance1.privateIp;
export const redisInstance2Id = redisInstance2.id;
export const redisInstance2PrivateIp = redisInstance2.privateIp;
export const redisInstance3Id = redisInstance3.id;
export const redisInstance3PrivateIp = redisInstance3.privateIp;
export const redisInstance4Id = redisInstance4.id;
export const redisInstance4PrivateIp = redisInstance4.privateIp;
export const redisInstance5Id = redisInstance5.id;
export const redisInstance5PrivateIp = redisInstance5.privateIp;
export const redisInstance6Id = redisInstance6.id;
export const redisInstance6PrivateIp = redisInstance6.privateIp;