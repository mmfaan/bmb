import { Routes, Route } from "react-router";
import AuthLayout from "./components/AuthLayout";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import CreatePost from "./pages/CreatePost";
import Messages from "./pages/Messages";
import Explore from "./pages/Explore";
import Notifications from "./pages/Notifications";
import PostDetail from "./pages/PostDetail";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <AuthLayout>
            <Home />
          </AuthLayout>
        }
      />
      <Route
        path="/profile/:userId"
        element={
          <AuthLayout>
            <Profile />
          </AuthLayout>
        }
      />
      <Route
        path="/create"
        element={
          <AuthLayout>
            <CreatePost />
          </AuthLayout>
        }
      />
      <Route
        path="/messages"
        element={
          <AuthLayout>
            <Messages />
          </AuthLayout>
        }
      />
      <Route
        path="/messages/:userId"
        element={
          <AuthLayout>
            <Messages />
          </AuthLayout>
        }
      />
      <Route
        path="/explore"
        element={
          <AuthLayout>
            <Explore />
          </AuthLayout>
        }
      />
      <Route
        path="/notifications"
        element={
          <AuthLayout>
            <Notifications />
          </AuthLayout>
        }
      />
      <Route
        path="/post/:postId"
        element={
          <AuthLayout>
            <PostDetail />
          </AuthLayout>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
