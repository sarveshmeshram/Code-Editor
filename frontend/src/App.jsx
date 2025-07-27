import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css';
import Editor from '@monaco-editor/react';
import { v4 as uuidv4 } from 'uuid';

const socket = io("http://localhost:10000");

const boilerplates = {
  javascript: `// JavaScript Boilerplate
function main() {
  console.log("Hello from JavaScript!");
}
main();`,

  cpp: `// C++ Boilerplate
#include <iostream>
using namespace std;

int main() {
    cout << "Hello from C++!" << endl;
    return 0;
}
`,

  python: `# Python Boilerplate
def main():
    print("Hello from Python!")

if __name__ == "__main__":
    main()
`,

  java: `// Java Boilerplate
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}
`,
};

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState(uuidv4());
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start code here");
  const [copySuccess, setCopySuccess] = useState("");
  const [typing, setTyping] = useState("");
  const [users, setUsers] = useState([]);
  const [outPut, setOutPut] = useState("");
  const [version, setVersion] = useState("*");
  const [userInput, setUserInput] = useState("");

  useEffect(() => {
    socket.on("userJoined", (users) => setUsers(users));
    socket.on("codeUpdate", (newCode) => setCode(newCode));
    socket.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 8)}... is typing`);
      setTimeout(() => setTyping(""), 2000);
    });
    socket.on("languageUpdate", (newLanguage) => setLanguage(newLanguage));
    socket.on("codeResponse", (response) => {
      setOutPut(response?.run?.output || "No output");
    });

    return () => {
      socket.off("userJoined");
      socket.off("codeUpdate");
      socket.off("userTyping");
      socket.off("languageUpdate");
      socket.off("codeResponse");
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.emit("leaveRoom");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const joinRoom = () => {
    if (roomId && userName) {
      socket.emit("join", { roomId, userName });
      setJoined(true);
    }
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId(uuidv4());
    setUserName("");
    setCode("// start code here");
    setLanguage("javascript");
    setUsers([]);
    setOutPut("");
    setUserInput("");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit("codeChange", { roomId, code: newCode });
    socket.emit("typing", { roomId, userName });
  };

  const handleLanguageChange = (e) => {
  const newLanguage = e.target.value;
  const boilerplate = boilerplates[newLanguage];

  setLanguage(newLanguage);
  setCode(boilerplate);

  socket.emit("languageChange", { roomId, language: newLanguage });
  socket.emit("codeChange", { roomId, code: boilerplate });
};


  const runCode = () => {
    socket.emit("compileCode", {
      code,
      roomId,
      language,
      version,
      input: userInput,
    });
  };
  
  if (!joined) {
    return (
      <div className='join-container'>
        <div className="join-form">
          <h1>Join Code Room</h1>
          <input
            type="text"
            placeholder="Enter Room ID..."
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <input
            type="text"
            placeholder="Enter User Name..."
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className='editor-container'>
      <div className='sidebar'>
        <div className='room-info'>
          <h2>Room: {roomId}</h2>
          <button className='copy-btn' onClick={copyRoomId}>Copy Room</button>
          {copySuccess && <span className='copy-success'>{copySuccess}</span>}
        </div>
        <h3>Users</h3>
        <ul>
          {users.map((user) => (
            <li key={user}>{user.slice(0, 8)}...</li>
          ))}
        </ul>
        <p className="typing-indicator">{typing}</p>
        <select className='language-selector' value={language} onChange={handleLanguageChange}>
          <option value="javascript">JavaScript</option>
          <option value="cpp">C++</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
        </select>
        <button className='leave-button' onClick={leaveRoom}>Leave Room</button>
      </div>

      <div className='editor-wrapper'>
        <Editor
          height="300px"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme='vs-dark'
          options={{
            minimap: { enabled: false },
            fontSize: 14,
          }}
        />
        <textarea
          className="user-input"
          placeholder="Enter input here..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
        <button className="run-btn" onClick={runCode}>Execute</button>
        <textarea
          className="output-console"
          value={outPut}
          readOnly
          placeholder="Output will appear here ..."
        />
      </div>
    </div>
  );
};

export default App;
