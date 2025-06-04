import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("WTTPPermissions", function () {
  let permissions: any;
  let owner: any;
  let siteAdmin: any;
  let resourceAdmin: any;
  let publicUser: any;

  const siteAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SITE_ADMIN_ROLE"));
  const defaultAdminRole = hre.ethers.zeroPadBytes("0x", 32);

  // Fixture to deploy the permissions contract
  async function deployPermissionsFixture() {
    [owner, siteAdmin, resourceAdmin, publicUser] = await hre.ethers.getSigners();
    
    const TestWTTPPermissions = await hre.ethers.getContractFactory("TestWTTPPermissions");
    permissions = await TestWTTPPermissions.deploy(owner.address);
    await permissions.waitForDeployment();
    
    return { permissions, owner, siteAdmin, resourceAdmin, publicUser };
  }

  describe("Deployment", function () {
    it("Should deploy with correct owner", async function () {
      const { permissions, owner } = await loadFixture(deployPermissionsFixture);
      
      expect(await permissions.hasRole(defaultAdminRole, owner.address)).to.be.true;
    });

    it("Should have correct default roles", async function () {
      const { permissions } = await loadFixture(deployPermissionsFixture);
      
      // Check that DEFAULT_ADMIN_ROLE is the admin of SITE_ADMIN_ROLE
      expect(await permissions.getRoleAdmin(siteAdminRole)).to.equal(defaultAdminRole);
    });

    it("Should correctly set SITE_ADMIN_ROLE", async function () {
      const { permissions } = await loadFixture(deployPermissionsFixture);
      
      // Use the public getter to verify the role is set correctly
      expect(await permissions.getSiteAdminRole()).to.equal(siteAdminRole);
    });
  });

  describe("Role Management", function () {
    it("Should allow owner to grant site admin role", async function () {
      const { permissions, owner, siteAdmin } = await loadFixture(deployPermissionsFixture);
      
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      expect(await permissions.hasRole(siteAdminRole, siteAdmin.address)).to.be.true;
    });

    it("Should allow site admin to create resource roles", async function () {
      const { permissions, owner, siteAdmin } = await loadFixture(deployPermissionsFixture);
      
      // Grant site admin role first
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE_ADMIN_ROLE"));
      
      await permissions.connect(siteAdmin).createResourceRole(resourceRole);
      
      // Check that the role admin is set correctly
      expect(await permissions.getRoleAdmin(resourceRole)).to.equal(siteAdminRole);
    });

    it("Should prevent non-admins from creating resource roles", async function () {
      const { permissions, publicUser } = await loadFixture(deployPermissionsFixture);
      
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("UNAUTHORIZED_ROLE"));
      
      await expect(
        permissions.connect(publicUser).createResourceRole(resourceRole)
      ).to.be.revertedWithCustomError(permissions, "AccessControlUnauthorizedAccount");
    });

    it("Should prevent creating admin roles via createResourceRole", async function () {
      const { permissions, owner, siteAdmin } = await loadFixture(deployPermissionsFixture);
      
      // Grant site admin role
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      // Try to create a site admin role (should fail due to notAdminRole modifier)
      await expect(
        permissions.connect(siteAdmin).createResourceRole(siteAdminRole)
      ).to.be.revertedWithCustomError(permissions, "InvalidRole");
      
      // Try to create default admin role (should fail)
      await expect(
        permissions.connect(siteAdmin).createResourceRole(defaultAdminRole)
      ).to.be.revertedWithCustomError(permissions, "InvalidRole");
    });

    it("Should allow site admin to grant resource roles", async function () {
      const { permissions, owner, siteAdmin, resourceAdmin } = await loadFixture(deployPermissionsFixture);
      
      // Setup
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE_ADMIN_ROLE"));
      await permissions.connect(siteAdmin).createResourceRole(resourceRole);
      
      // Grant resource role
      await permissions.connect(siteAdmin).grantRole(resourceRole, resourceAdmin.address);
      expect(await permissions.hasRole(resourceRole, resourceAdmin.address)).to.be.true;
    });

    it("Should allow site admin to revoke resource roles", async function () {
      const { permissions, owner, siteAdmin, resourceAdmin } = await loadFixture(deployPermissionsFixture);
      
      // Setup
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE_ADMIN_ROLE"));
      await permissions.connect(siteAdmin).createResourceRole(resourceRole);
      await permissions.connect(siteAdmin).grantRole(resourceRole, resourceAdmin.address);
      
      // Revoke
      await permissions.connect(siteAdmin).revokeRole(resourceRole, resourceAdmin.address);
      expect(await permissions.hasRole(resourceRole, resourceAdmin.address)).to.be.false;
    });
  });

  describe("Access Control", function () {
    it("Should prevent unauthorized role creation", async function () {
      const { permissions, resourceAdmin } = await loadFixture(deployPermissionsFixture);
      
      const unauthorizedRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("UNAUTHORIZED_ROLE"));
      
      await expect(
        permissions.connect(resourceAdmin).createResourceRole(unauthorizedRole)
      ).to.be.revertedWithCustomError(permissions, "AccessControlUnauthorizedAccount");
    });

    it("Should prevent unauthorized role granting", async function () {
      const { permissions, owner, siteAdmin, publicUser, resourceAdmin } = await loadFixture(deployPermissionsFixture);
      
      // Setup
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE_ADMIN_ROLE"));
      await permissions.connect(siteAdmin).createResourceRole(resourceRole);
      
      // Public user tries to grant role
      await expect(
        permissions.connect(publicUser).grantRole(resourceRole, resourceAdmin.address)
      ).to.be.revertedWithCustomError(permissions, "AccessControlUnauthorizedAccount");
    });

    it("Should allow owner to grant and revoke any role", async function () {
      const { permissions, owner, resourceAdmin } = await loadFixture(deployPermissionsFixture);
      
      // Owner should be able to grant site admin role directly
      await permissions.connect(owner).grantRole(siteAdminRole, resourceAdmin.address);
      expect(await permissions.hasRole(siteAdminRole, resourceAdmin.address)).to.be.true;
      
      // Owner should be able to revoke it
      await permissions.connect(owner).revokeRole(siteAdminRole, resourceAdmin.address);
      expect(await permissions.hasRole(siteAdminRole, resourceAdmin.address)).to.be.false;
    });

    it("Should grant DEFAULT_ADMIN_ROLE holders access to all roles", async function () {
      const { permissions, owner } = await loadFixture(deployPermissionsFixture);
      
      // Create a random role that owner doesn't explicitly have
      const randomRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RANDOM_ROLE"));
      
      // Owner should have access due to being DEFAULT_ADMIN_ROLE holder
      expect(await permissions.hasRole(randomRole, owner.address)).to.be.true;
      expect(await permissions.hasRole(siteAdminRole, owner.address)).to.be.true;
    });
  });

  describe("Role Hierarchy", function () {
    it("Should respect role hierarchy for resource roles", async function () {
      const { permissions, owner, siteAdmin, resourceAdmin } = await loadFixture(deployPermissionsFixture);
      
      // Setup role hierarchy
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE_ADMIN_ROLE"));
      await permissions.connect(siteAdmin).createResourceRole(resourceRole);
      
      // Site admin should be able to manage resource admins
      await permissions.connect(siteAdmin).grantRole(resourceRole, resourceAdmin.address);
      expect(await permissions.hasRole(resourceRole, resourceAdmin.address)).to.be.true;
      
      // Verify role admin relationship
      expect(await permissions.getRoleAdmin(resourceRole)).to.equal(siteAdminRole);
    });

    it("Should allow checking multiple roles for an account", async function () {
      const { permissions, owner, siteAdmin } = await loadFixture(deployPermissionsFixture);
      
      // Grant multiple roles
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      const resourceRole1 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE1_ADMIN_ROLE"));
      const resourceRole2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE2_ADMIN_ROLE"));
      
      await permissions.connect(siteAdmin).createResourceRole(resourceRole1);
      await permissions.connect(siteAdmin).createResourceRole(resourceRole2);
      await permissions.connect(siteAdmin).grantRole(resourceRole1, siteAdmin.address);
      await permissions.connect(siteAdmin).grantRole(resourceRole2, siteAdmin.address);
      
      // Check all roles
      expect(await permissions.hasRole(siteAdminRole, siteAdmin.address)).to.be.true;
      expect(await permissions.hasRole(resourceRole1, siteAdmin.address)).to.be.true;
      expect(await permissions.hasRole(resourceRole2, siteAdmin.address)).to.be.true;
    });
  });

  describe("Site Admin Management", function () {
    it("Should allow owner to change site admin role", async function () {
      const { permissions, owner, siteAdmin, publicUser } = await loadFixture(deployPermissionsFixture);
      
      // Grant site admin role to siteAdmin first
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      expect(await permissions.hasRole(siteAdminRole, siteAdmin.address)).to.be.true;
      
      // Change site admin role identifier
      const newSiteAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NEW_SITE_ADMIN_ROLE"));
      
      await expect(permissions.connect(owner).changeSiteAdmin(newSiteAdminRole))
        .to.emit(permissions, "SiteAdminChanged")
        .withArgs(siteAdminRole, newSiteAdminRole);
      
      // Verify the role identifier changed
      expect(await permissions.getSiteAdminRole()).to.equal(newSiteAdminRole);
      
      // Old role should no longer work (siteAdmin no longer has the current SITE_ADMIN_ROLE)
      expect(await permissions.hasRole(await permissions.getSiteAdminRole(), siteAdmin.address)).to.be.false;
      
      // Grant new role to verify it works
      await permissions.connect(owner).grantRole(newSiteAdminRole, publicUser.address);
      expect(await permissions.hasRole(newSiteAdminRole, publicUser.address)).to.be.true;
    });

    it("Should prevent non-owners from changing site admin role", async function () {
      const { permissions, siteAdmin } = await loadFixture(deployPermissionsFixture);
      
      const newSiteAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NEW_SITE_ADMIN_ROLE"));
      
      await expect(
        permissions.connect(siteAdmin).changeSiteAdmin(newSiteAdminRole)
      ).to.be.revertedWithCustomError(permissions, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Events", function () {
    it("Should emit RoleGranted events", async function () {
      const { permissions, owner, siteAdmin } = await loadFixture(deployPermissionsFixture);
      
      await expect(permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address))
        .to.emit(permissions, "RoleGranted")
        .withArgs(siteAdminRole, siteAdmin.address, owner.address);
    });

    it("Should emit RoleRevoked events", async function () {
      const { permissions, owner, siteAdmin } = await loadFixture(deployPermissionsFixture);
      
      // Grant first
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      // Then revoke
      await expect(permissions.connect(owner).revokeRole(siteAdminRole, siteAdmin.address))
        .to.emit(permissions, "RoleRevoked")
        .withArgs(siteAdminRole, siteAdmin.address, owner.address);
    });

    it("Should emit RoleAdminChanged events for resource roles", async function () {
      const { permissions, owner, siteAdmin } = await loadFixture(deployPermissionsFixture);
      
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TEST_RESOURCE_ROLE"));
      
      await expect(permissions.connect(siteAdmin).createResourceRole(resourceRole))
        .to.emit(permissions, "RoleAdminChanged")
        .withArgs(resourceRole, defaultAdminRole, siteAdminRole);
    });

    it("Should emit ResourceRoleCreated events", async function () {
      const { permissions, owner, siteAdmin } = await loadFixture(deployPermissionsFixture);
      
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      const resourceRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("TEST_RESOURCE_ROLE"));
      
      await expect(permissions.connect(siteAdmin).createResourceRole(resourceRole))
        .to.emit(permissions, "ResourceRoleCreated")
        .withArgs(resourceRole);
    });
  });

  describe("Modifiers and Edge Cases", function () {
    it("Should test notAdminRole modifier", async function () {
      const { permissions } = await loadFixture(deployPermissionsFixture);
      
      const regularRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("REGULAR_ROLE"));
      
      // Should not revert for regular role
      await permissions.testNotAdminRoleModifier(regularRole);
      
      // Should revert for admin roles
      await expect(
        permissions.testNotAdminRoleModifier(siteAdminRole)
      ).to.be.revertedWithCustomError(permissions, "InvalidRole");
      
      await expect(
        permissions.testNotAdminRoleModifier(defaultAdminRole)
      ).to.be.revertedWithCustomError(permissions, "InvalidRole");
    });

    it("Should handle zero address correctly", async function () {
      const { permissions } = await loadFixture(deployPermissionsFixture);
      
      expect(await permissions.hasRole(siteAdminRole, hre.ethers.ZeroAddress)).to.be.false;
    });

    it("Should handle non-existent roles", async function () {
      const { permissions, publicUser } = await loadFixture(deployPermissionsFixture);
      
      const nonExistentRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("NON_EXISTENT_ROLE"));
      expect(await permissions.hasRole(nonExistentRole, publicUser.address)).to.be.false;
    });

    it("Should not allow granting the same role twice", async function () {
      const { permissions, owner, siteAdmin } = await loadFixture(deployPermissionsFixture);
      
      // Grant role first time
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      // Granting again should not revert but should be a no-op
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      
      expect(await permissions.hasRole(siteAdminRole, siteAdmin.address)).to.be.true;
    });

    it("Should handle role renunciation", async function () {
      const { permissions, owner, siteAdmin } = await loadFixture(deployPermissionsFixture);
      
      // Grant role
      await permissions.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
      expect(await permissions.hasRole(siteAdminRole, siteAdmin.address)).to.be.true;
      
      // Renounce role
      await permissions.connect(siteAdmin).renounceRole(siteAdminRole, siteAdmin.address);
      expect(await permissions.hasRole(siteAdminRole, siteAdmin.address)).to.be.false;
    });
  });
}); 