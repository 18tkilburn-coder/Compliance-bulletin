-- CreateTable
CREATE TABLE "FavouriteEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FavouriteEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FavouriteEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "BulletinEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "completedItems" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistProgress_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "BulletinEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FavouriteEntry_userId_entryId_key" ON "FavouriteEntry"("userId", "entryId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistProgress_userId_entryId_key" ON "ChecklistProgress"("userId", "entryId");
