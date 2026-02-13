<template>
  <header>
    <!-- Show the sign-in and sign-up buttons when the user is signed out -->
    <SignedOut>
      <SignInButton />
      <SignUpButton />
    </SignedOut>
    <!-- Show the user button when the user is signed in -->
    <SignedIn>
      <UserButton />
    </SignedIn>
  </header>

  <main>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </main>
</template>
